import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, ArrowRight, Loader2, X, Building2 } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { friendlyMessage } from '../lib/errors';
import { ContactSalesModal } from './ContactSalesModal';

interface PlanOption {
  key: string;
  name: string;
  price: string;
  period: string;
  cta?: string;
  features: string[];
  highlight?: boolean;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    key: 'team',
    name: 'Team',
    price: '$29',
    period: 'per person / month',
    cta: 'Choose Team',
    features: [
      'Unlimited AI generation across all modules',
      'Unlimited projects',
      'Up to 10 team members',
      'CSV import & export',
      'Executive dashboard',
      'Priority email support',
    ],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    cta: 'Contact Sales',
    features: [
      'Everything in Team, plus:',
      'Unlimited team members',
      'SSO authentication',
      'IP allowlisting',
      'Data isolation enforcement',
      'Dedicated support & onboarding',
    ],
  },
];

export function UpgradeModal({
  open,
  onClose,
  triggerFeature,
}: {
  open: boolean;
  onClose: () => void;
  triggerFeature?: string;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSalesModal, setShowSalesModal] = useState(false);

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        navigate('/signin');
        return;
      }

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
    setLoading(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Upgrade your plan" maxWidth="max-w-2xl">
      <div className="text-center py-2 mb-4">
        <div className="w-12 h-12 rounded-xl bg-thread-bg flex items-center justify-center mx-auto mb-3">
          <Sparkles size={22} className="text-thread" />
        </div>
        {triggerFeature ? (
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text">{triggerFeature}</span> is a paid feature. Pick a plan below to unlock it.
          </p>
        ) : (
          <p className="text-sm text-text-muted">Pick a plan below to unlock premium features.</p>
        )}
      </div>

      {error && (
        <div className="mb-4 text-xs text-red bg-red/5 border border-red/20 rounded-lg p-3 flex items-start gap-2">
          <X size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLAN_OPTIONS.map((plan) => (
          <div
            key={plan.key}
            className={`card p-5 flex flex-col relative ${plan.highlight ? 'border-thread ring-1 ring-thread/30' : ''}`}
          >
            {plan.highlight && (
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
            <button
              className={`btn w-full ${plan.highlight ? 'btn-primary' : 'btn-ghost border border-line'}`}
              onClick={() => plan.key === 'enterprise' ? setShowSalesModal(true) : handleUpgrade(plan.key)}
              disabled={loading !== null && plan.key !== 'enterprise'}
            >
              {loading === plan.key ? (
                <><Loader2 size={15} className="animate-spin" /> Redirecting…</>
              ) : plan.key === 'enterprise' ? (
                <><Building2 size={15} /> {plan.cta} <ArrowRight size={15} /></>
              ) : (
                <>Choose {plan.name} <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm w-full mt-4" onClick={onClose}>Maybe later</button>

      <ContactSalesModal open={showSalesModal} onClose={() => setShowSalesModal(false)} />
    </Modal>
  );
}
