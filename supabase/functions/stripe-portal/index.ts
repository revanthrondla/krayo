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

/**
 * Only allow redirect targets on this application's own origin, so a crafted
 * request cannot point the billing portal return link at an attacker's site.
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

    const { return_url } = await req.json();
    const safeReturnUrl = allowedRedirect(return_url, req);
    if (!safeReturnUrl) {
      return corsResponse({ error: 'Invalid return_url' }, 400);
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

    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!customer?.customer_id) {
      return corsResponse({ error: 'No billing account found. Subscribe to a plan first.' }, 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customer_id,
      return_url: safeReturnUrl,
    });

    return corsResponse({ url: session.url });
  } catch (error: any) {
    console.error(`Portal error: ${error?.message}`);
    return corsResponse({ error: 'Could not open the billing portal. Please try again.' }, 500);
  }
});
