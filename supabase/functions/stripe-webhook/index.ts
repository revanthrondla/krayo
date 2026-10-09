import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Bolt Integration', version: '1.0.0' },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) return new Response('No signature found', { status: 400, headers: corsHeaders });

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response('Invalid signature', { status: 400, headers: corsHeaders });
    }

    EdgeRuntime.waitUntil(handleEvent(event));
    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};
  if (!stripeData || !('customer' in stripeData)) return;

  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) return;

  const { customer: customerId } = stripeData;
  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
    return;
  }

  let isSubscription = true;

  if (event.type === 'checkout.session.completed') {
    const { mode } = stripeData as Stripe.Checkout.Session;
    isSubscription = mode === 'subscription';
    console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
  }

  const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

  if (isSubscription) {
    console.info(`Starting subscription sync for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId);
  } else if (mode === 'payment' && payment_status === 'paid') {
    try {
      const { id: checkout_session_id, payment_intent, amount_subtotal, amount_total, currency } = stripeData as Stripe.Checkout.Session;
      const { error: orderError } = await supabase.from('stripe_orders').insert({
        checkout_session_id, payment_intent_id: payment_intent, customer_id: customerId,
        amount_subtotal, amount_total, currency, payment_status, status: 'completed',
      });
      if (orderError) console.error('Error inserting order:', orderError);
    } catch (error) {
      console.error('Error processing one-time payment:', error);
    }
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId, limit: 1, status: 'all', expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error } = await supabase.from('stripe_subscriptions').upsert(
        { customer_id: customerId, subscription_status: 'not_started' },
        { onConflict: 'customer_id' },
      );
      if (error) console.error('Error updating subscription status:', error);
      return;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? { payment_method_brand: subscription.default_payment_method.card?.brand ?? null, payment_method_last4: subscription.default_payment_method.card?.last4 ?? null }
          : {}),
        status: subscription.status,
      },
      { onConflict: 'customer_id' },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    // Update org plan based on subscription metadata
    const subMetadata = subscription.metadata || {};
    const orgId = subMetadata.orgId;
    const plan = subMetadata.plan;

    if (orgId && plan) {
      let newPlan = plan;
      let billingStatus = 'active';

      if (subscription.status === 'active') {
        newPlan = plan;
        billingStatus = 'active';
      } else if (subscription.status === 'past_due') {
        billingStatus = 'past_due';
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        newPlan = 'free';
        billingStatus = 'canceled';
      } else if (subscription.status === 'trialing') {
        billingStatus = 'trialing';
      }

      const { error: orgError } = await supabase
        .from('organizations')
        .update({ plan: newPlan, billing_status: billingStatus })
        .eq('id', orgId);

      if (orgError) console.error('Error updating org plan:', orgError);
      else {
        console.info(`Updated org ${orgId} to plan=${newPlan}, billing=${billingStatus}`);

        if (subscription.status === 'active' && newPlan !== 'free') {
          await sendUpgradeConfirmationEmail(customerId, newPlan, subscription.current_period_end);
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await sendCancellationEmail(customerId);
        }
      }
    }

    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}

async function sendUpgradeConfirmationEmail(customerId: string, plan: string, periodEnd: number) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured — upgrade email not sent');
    return;
  }

  try {
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!customer?.user_id) return;

    const { data: authUser } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', customer.user_id)
      .maybeSingle();
    if (!authUser?.email) return;

    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    const price = plan === 'team' ? '$49' : plan === 'enterprise' ? '$199' : '';
    const renewalDate = periodEnd
      ? new Date(periodEnd * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : 'your next billing cycle';

    const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0;">Krayo</h1>
  </div>
  <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">You're now on the ${planName} plan!</h2>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 16px 0;">
    Your subscription is active. Here's a summary of your new plan:
  </p>
  <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 16px 0;">
    <p style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #1a1a2e;">${planName} Plan — ${price}/month</p>
    <p style="font-size: 13px; color: #8a8a9a; margin: 0;">Next renewal: ${renewalDate}</p>
  </div>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 16px 0;">
    You now have access to all ${planName} features${plan === 'team' ? ' including unlimited AI generation, unlimited projects, and team collaboration' : ' including SSO, IP allowlisting, and advanced data isolation'}.
  </p>
  <a href="${Deno.env.get('APP_URL') ?? 'http://localhost:5173'}/app" style="display: inline-block; background: #2d6a4f; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
    Go to Krayo
  </a>
  <hr style="border: none; border-top: 1px solid #e0e0e8; margin: 24px 0;" />
  <p style="font-size: 12px; color: #a0a0b0; margin: 0;">You're receiving this email because your Krayo subscription was updated. You can manage your subscription anytime from the Billing &amp; Plans page.</p>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Krayo <noreply@krayo.app>',
        to: [authUser.email],
        subject: `Welcome to the ${planName} plan!`,
        html,
      }),
    });
    console.info(`Upgrade confirmation email sent to ${authUser.email}`);
  } catch (error) {
    console.error('Failed to send upgrade confirmation email:', error);
  }
}

async function sendCancellationEmail(customerId: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return;

  try {
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!customer?.user_id) return;

    const { data: authUser } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', customer.user_id)
      .maybeSingle();
    if (!authUser?.email) return;

    const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0;">Krayo</h1>
  </div>
  <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Your subscription has ended</h2>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 16px 0;">
    Your subscription has been cancelled and your organization is now on the Free plan. You still have access to one project with full manual access to every module.
  </p>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 16px 0;">
    Need AI generation, more projects, or team collaboration again? You can resubscribe anytime from the Billing &amp; Plans page.
  </p>
  <a href="${Deno.env.get('APP_URL') ?? 'http://localhost:5173'}/app/billing" style="display: inline-block; background: #2d6a4f; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
    Resubscribe
  </a>
  <hr style="border: none; border-top: 1px solid #e0e0e8; margin: 24px 0;" />
  <p style="font-size: 12px; color: #a0a0b0; margin: 0;">You're receiving this email because your Krayo subscription was cancelled.</p>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Krayo <noreply@krayo.app>',
        to: [authUser.email],
        subject: 'Your Krayo subscription has ended',
        html,
      }),
    });
    console.info(`Cancellation email sent to ${authUser.email}`);
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
  }
}
