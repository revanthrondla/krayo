import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Bolt Integration', version: '1.0.0' },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const PLAN_PRICES: Record<string, { price: number; name: string }> = {
  team: { price: 2900, name: 'Team Plan' },
};

/**
 * Only allow redirect targets on this application's own origin, so a crafted
 * request cannot turn a Stripe checkout into a redirect to an attacker's site.
 */
function allowedRedirect(raw: unknown, req: Request): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const allowed = new Set<string>();
  const appUrl = Deno.env.get('APP_URL');
  if (appUrl) {
    try { allowed.add(new URL(appUrl).origin); } catch { /* ignore malformed config */ }
  }
  if (allowed.size === 0) {
    const origin = req.headers.get('Origin');
    if (origin) {
      try { allowed.add(new URL(origin).origin); } catch { /* ignore */ }
    }
  }
  if (allowed.size === 0) return null;
  return allowed.has(parsed.origin) ? parsed.toString() : null;
}

function corsResponse(body: string | object | null, status = 200) {
  if (status === 204) return new Response(null, { status, headers: corsHeaders });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return corsResponse({}, 204);
    if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

    const { plan, success_url, cancel_url } = await req.json();

    if (!plan || !['team'].includes(plan)) {
      return corsResponse({ error: 'Invalid plan. Must be "team".' }, 400);
    }
    const safeSuccessUrl = allowedRedirect(success_url, req);
    if (!safeSuccessUrl) {
      return corsResponse({ error: 'Invalid success_url' }, 400);
    }
    const safeCancelUrl = allowedRedirect(cancel_url, req);
    if (!safeCancelUrl) {
      return corsResponse({ error: 'Invalid cancel_url' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }

    // Get the user's organization(s) — use the first org they're a member of
    const { data: membership, error: memberError } = await supabase
      .from('org_memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      return corsResponse({ error: 'You must belong to an organization to upgrade.' }, 400);
    }

    if (membership.role !== 'Owner' && membership.role !== 'Admin') {
      return corsResponse({ error: 'Only an organization owner or admin can change the plan.' }, 403);
    }

    const orgId = membership.org_id;

    // Get or create Stripe customer
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    let customerId = customer?.customer_id;

    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id, orgId },
      });
      customerId = newCustomer.id;
      await supabase.from('stripe_customers').insert({ user_id: user.id, customer_id: customerId });
    }

    // Create subscription record if missing
    const { data: existingSub } = await supabase
      .from('stripe_subscriptions')
      .select('customer_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!existingSub) {
      await supabase.from('stripe_subscriptions').insert({ customer_id: customerId, status: 'not_started' });
    }

    const planInfo = PLAN_PRICES[plan];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: planInfo.name },
          unit_amount: planInfo.price,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: safeSuccessUrl,
      cancel_url: safeCancelUrl,
      metadata: { orgId, plan, userId: user.id },
      subscription_data: { metadata: { orgId, plan, userId: user.id } },
    });

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error?.message}`);
    return corsResponse({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
