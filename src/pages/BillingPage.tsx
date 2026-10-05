import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, ArrowRight, Loader2, Sparkles, AlertCircle, ExternalLink, RefreshCw, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org-context';
import { Loading } from '../components/States';
import { UpgradeModal } from '../components/UpgradeModal';
import { ContactSalesModal } from '../components/ContactSalesModal';
import { friendlyMessage } from '../lib/errors';

interface PlanInfo {
  key: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanInfo[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['1 project', '1 team member (solo)', 'Full CRUD on all modules', 'CSV import & export', 'Executive dashboard'],
  },
  {
    key: 'team',
    name: 'Team',
    price: '$49',
    period: '/month',
    features: ['Unlimited projects', 'Up to 10 team members', 'Unlimited AI generation', 'All Free features', 'Priority email support'],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited team members', 'SSO authentication', 'IP allowlisting', 'Data isolation enforcement', 'Dedicated support & onboarding'],
  },
];

export function BillingPage() {
  const { activeOrg, refreshOrgs } = useOrg();
  const [searchParams] = useSearchParams();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string | null;
    current_period_end: number | null;
    payment_method_brand: string | null;
    payment_method_last4: string | null;
    cancel_at_period_end: boolean;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  const upgraded = searchParams.get('upgraded');

  const fetchSubscription = useCallback(async () => {
    if (!activeOrg) return;
    setSubLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (customer?.customer_id) {
        const { data: sub } = await supabase
          .from('stripe_subscriptions')
          .select('status, current_period_end, payment_method_brand, payment_method_last4, cancel_at_period_end')
          .eq('customer_id', customer.customer_id)
          .maybeSingle();
        if (sub) setSubscription(sub);
      }
    } catch { /* ignore */ }
    setSubLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (upgraded) {
      setSuccessMsg(`Your ${upgraded.charAt(0).toUpperCase() + upgraded.slice(1)} plan is now active!`);
      refreshOrgs();
      const timer = setTimeout(() => setSuccessMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [upgraded, refreshOrgs]);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan,
          success_url: `${origin}/app/billing?upgraded=${plan}`,
          cancel_url: `${origin}/app/billing`,
        },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to start checkout. Please try again.'));
    }
    setCheckoutLoading(null);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data, error: fnError } = await supabase.functions.invoke('stripe-portal', {
        body: { return_url: `${origin}/app/billing` },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to open billing portal. Please try again.'));
    }
    setPortalLoading(false);
  };

  if (!activeOrg) return <Loading label="Loading billing…" />;

  const currentPlan = activeOrg.plan;
  const isPaid = currentPlan === 'team' || currentPlan === 'enterprise';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">Billing & Plans</h1>
        <p className="text-sm text-text-muted">Manage your subscription, change plans, and view payment details.</p>
      </div>

      {successMsg && (
        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <Check size={16} className="shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red bg-red/5 border border-red/20 rounded-lg p-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Current plan summary */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><CreditCard size={16} className="text-thread" /> Current Plan</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { refreshOrgs(); fetchSubscription(); }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Plan</p>
            <p className="text-sm font-semibold capitalize">{currentPlan}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Billing status</p>
            <p className="text-sm font-semibold capitalize">{activeOrg.billing_status}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">License seats</p>
            <p className="text-sm font-semibold">{activeOrg.license_seats}</p>
          </div>
        </div>

        {isPaid && !subLoading && subscription && (
          <div className="mt-4 pt-4 border-t border-line space-y-2">
            {subscription.current_period_end && (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Next billing date</span>
                <span className="font-medium">{new Date(subscription.current_period_end * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            )}
            {subscription.payment_method_brand && (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Payment method</span>
                <span className="font-medium capitalize">{subscription.payment_method_brand} •••• {subscription.payment_method_last4}</span>
              </div>
            )}
            {subscription.cancel_at_period_end && (
              <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2.5 mt-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Subscription cancelled — your plan remains active until the end of the current billing period.</span>
              </div>
            )}
          </div>
        )}

        {isPaid && (
          <div className="mt-4">
            <button className="btn btn-ghost btn-sm border border-line" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? <><Loader2 size={14} className="animate-spin" /> Loading…</> : <><ExternalLink size={14} /> Manage billing in Stripe</>}
            </button>
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isDowngrade = plan.key === 'free' && isPaid;
            return (
              <div key={plan.key} className={`card p-5 flex flex-col relative ${plan.highlight ? 'border-thread ring-1 ring-thread/30' : ''}`}>
                {plan.highlight && !isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-thread text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-base font-bold text-text">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1 mb-4">
                  <span className="text-2xl font-bold text-text">{plan.price}</span>
                  <span className="text-sm text-text-muted">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text">
                      <Check size={13} className="text-thread shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="btn btn-ghost btn-sm w-full border border-line text-text-muted cursor-default">Current plan</div>
                ) : isDowngrade ? (
                  <button className="btn btn-ghost btn-sm w-full border border-line" onClick={handlePortal} disabled={portalLoading}>
                    Cancel subscription
                  </button>
                ) : plan.key === 'free' ? (
                  <div className="btn btn-ghost btn-sm w-full border border-line text-text-muted cursor-default">Free forever</div>
                ) : plan.key === 'enterprise' ? (
                  <button className="btn w-full btn-ghost border border-line" onClick={() => setShowSalesModal(true)}>
                    <Building2 size={15} /> Contact Sales <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className={`btn w-full ${plan.highlight ? 'btn-primary' : 'btn-ghost border border-line'}`}
                    onClick={() => handleCheckout(plan.key)}
                    disabled={checkoutLoading !== null}
                  >
                    {checkoutLoading === plan.key ? (
                      <><Loader2 size={15} className="animate-spin" /> Redirecting…</>
                    ) : (
                      <>Choose {plan.name} <ArrowRight size={15} /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI feature callout for free users */}
      {currentPlan === 'free' && (
        <div className="card p-5 bg-thread-bg/30 border-thread/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-thread-bg flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-thread" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text mb-1">Unlock AI Generation</h3>
              <p className="text-xs text-text-muted mb-3">Describe your project in plain English and instantly generate requirements, test cases, defects, and more — ready for your review.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowUpgradeModal(true)}>
                <Sparkles size={14} /> Upgrade now <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} triggerFeature="AI Generation" />
      <ContactSalesModal open={showSalesModal} onClose={() => setShowSalesModal(false)} />
    </div>
  );
}
