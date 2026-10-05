import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, FlaskConical, Network,
  BarChart3, ShieldAlert, Upload, Check, ChevronDown,
  Zap, Users, Building2, Lock, Infinity as InfinityIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { KrayoLogo } from '../components/Logo';
import { ContactSalesModal } from '../components/ContactSalesModal';

const FEATURES = [
  { icon: Sparkles, title: 'AI-Powered Generation', desc: 'Describe your project in plain English. AI generates requirements, test cases, defects, RAID entries, and more — ready for your review.' },
  { icon: Network, title: 'Full Traceability', desc: 'Link requirements to test cases to defects with a live Requirements Traceability Matrix. Never lose the thread.' },
  { icon: BarChart3, title: 'Executive Dashboard', desc: 'Track milestones, past-due items, and project health at a glance. Built for steering committees and status reporting.' },
  { icon: ShieldAlert, title: 'RAID Log Management', desc: 'Risks, assumptions, issues, and dependencies — all tracked, owned, and visible across your team.' },
  { icon: FlaskConical, title: 'Test Case Management', desc: 'Author test cases with steps and expected results. Track execution status by cycle. Link to requirements automatically.' },
  { icon: Upload, title: 'Import & Export', desc: 'Bring data in via CSV or export anytime. Zero lock-in. Your data is always yours.' },
];

const STEPS = [
  { num: '01', title: 'Describe your project', desc: 'Tell Krayo what you\'re building in a sentence or two. No templates, no setup.' },
  { num: '02', title: 'AI generates the artifacts', desc: 'Requirements, test cases, defects, RAID entries — all drafted from your description, ready to review and edit.' },
  { num: '03', title: 'Track to completion', desc: 'Monitor progress with executive dashboards, action items, and full traceability from requirement to defect.' },
];

const PLANS = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    tagline: 'For solo QA testers exploring the platform',
    cta: 'Start free',
    highlight: false,
    features: [
      { text: '1 project', included: true },
      { text: 'Full CRUD on all modules', included: true },
      { text: 'CSV import & export', included: true },
      { text: 'Executive dashboard', included: true },
      { text: 'AI generation', included: false },
      { text: 'Team collaboration', included: false },
      { text: 'SSO & security controls', included: false },
    ],
  },
  {
    name: 'Team',
    price: 49,
    period: 'per seat / month',
    tagline: 'For QA teams who want to move fast',
    cta: 'Start 14-day trial',
    highlight: true,
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'Full CRUD on all modules', included: true },
      { text: 'CSV import & export', included: true },
      { text: 'Executive dashboard', included: true },
      { text: 'AI generation (unlimited)', included: true },
      { text: 'Up to 10 team members', included: true },
      { text: 'SSO & security controls', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: null,
    period: '',
    tagline: 'For large orgs with security & compliance needs',
    cta: 'Contact Sales',
    highlight: false,
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'Full CRUD on all modules', included: true },
      { text: 'CSV import & export', included: true },
      { text: 'Executive dashboard', included: true },
      { text: 'AI generation (unlimited)', included: true },
      { text: 'Unlimited seats', included: true },
      { text: 'SSO, IP allowlist, data isolation', included: true },
    ],
  },
];

const FAQS = [
  { q: 'What\'s included in the free plan?', a: 'You get one project with full access to every module — requirements, test cases, defects, traceability, RAID logs, executive dashboards, and CSV import/export. The only thing locked is AI generation. You can create everything manually, for free, forever.' },
  { q: 'How does AI generation work?', a: 'When you upgrade to Team, every module gets an "AI Generate" button. Describe your project or feature in plain English, and Krayo drafts requirements, test cases, defects, or RAID entries for you to review and approve. Nothing is added without your sign-off.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Yes. Start on Free, upgrade to Team when you need AI or a second project, and move to Enterprise when you need SSO and advanced security controls. Your data moves with you — no migration required.' },
  { q: 'Is my data secure?', a: 'Every project is isolated with row-level security. Enterprise plans add IP allowlists, SSO enforcement, project-level membership controls, and data isolation between projects.' },
  { q: 'Do I need a credit card to start?', a: 'No. The Free plan requires no payment information. Team plans start with a 14-day trial — no card charged until the trial ends.' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showSalesModal, setShowSalesModal] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base">
            <KrayoLogo size={22} /> Krayo
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <button className="px-3 py-1.5 text-sm font-semibold text-ink bg-thread-bg rounded-md">Product</button>
              <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/developer')}>Developer</button>
              <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/blog')}>Blog</button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(user ? '/app' : '/signin')}>
              {user ? 'Go to app' : 'Sign in'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/signup')}>
              Get started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile tab nav */}
      <div className="sm:hidden border-b border-line bg-card">
        <div className="flex">
          <button className="flex-1 py-2.5 text-xs font-semibold text-ink bg-thread-bg">Product</button>
          <button className="flex-1 py-2.5 text-xs font-medium text-text-muted" onClick={() => navigate('/developer')}>Developer</button>
          <button className="flex-1 py-2.5 text-xs font-medium text-text-muted" onClick={() => navigate('/blog')}>Blog</button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-thread/5 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-thread-bg text-thread text-xs font-medium mb-6 animate-fade-in">
            <Sparkles size={13} /> AI-powered QA project management
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-ink tracking-tight mb-5 leading-[1.1]">
            QA project management,<br />
            <span className="text-thread">threaded together.</span>
          </h1>
          <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Requirements, test cases, defects, traceability, RAID logs, and executive dashboards —
            all in one place. Start free, upgrade when you need AI to do the heavy lifting.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button className="btn btn-primary text-base px-5 py-2.5" onClick={() => navigate('/signup')}>
              Start free <ArrowRight size={17} />
            </button>
            <button className="btn btn-ghost text-base px-5 py-2.5" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              See pricing
            </button>
          </div>
          <p className="text-xs text-text-faint mt-4">No credit card required · Free forever plan</p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-line bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-text-faint">
          {[
            { icon: Check, label: 'No credit card required' },
            { icon: Check, label: 'CSV import & export' },
            { icon: Check, label: 'Full traceability' },
            { icon: Check, label: 'Zero lock-in' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs font-medium">
              <Check size={14} className="text-thread" /> {item.label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-3">Everything your QA project needs</h2>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">From requirements to defects to executive reporting — Krayo keeps every thread of your project connected.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 hover:border-thread/30 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-thread-bg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon size={20} className="text-thread" />
              </div>
              <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card border-y border-line">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-3">How it works</h2>
            <p className="text-text-muted text-lg">Three steps from blank slate to full project plan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="text-4xl font-bold text-thread/20 mb-3">{step.num}</div>
                <h3 className="font-semibold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-3">Simple, transparent pricing</h2>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">Start free. Upgrade when you need AI generation or team collaboration. No surprises.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`card p-7 relative ${plan.highlight ? 'border-thread ring-2 ring-thread/20 shadow-lg md:scale-105' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-thread text-white text-xs font-semibold">
                  Most popular
                </div>
              )}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  {plan.name === 'Free' && <InfinityIcon size={18} className="text-text-muted" />}
                  {plan.name === 'Team' && <Users size={18} className="text-thread" />}
                  {plan.name === 'Enterprise' && <Building2 size={18} className="text-text-muted" />}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                </div>
                <p className="text-xs text-text-muted">{plan.tagline}</p>
              </div>
              <div className="mb-5">
                {plan.price !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-ink">${plan.price}</span>
                    <span className="text-sm text-text-muted">/{plan.period}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-ink">Custom</span>
                  </div>
                )}
              </div>
              <button
                className={`btn w-full mb-6 ${plan.highlight ? 'btn-primary' : 'btn-ghost border border-line'}`}
                onClick={() => plan.name === 'Enterprise' ? setShowSalesModal(true) : navigate('/signup')}
              >
                {plan.cta} {plan.name === 'Enterprise' ? <ArrowRight size={15} /> : <ArrowRight size={15} />}
              </button>
              <div className="space-y-2.5">
                {plan.features.map((feat) => (
                  <div key={feat.text} className="flex items-start gap-2.5">
                    {feat.included ? (
                      <Check size={16} className="text-thread shrink-0 mt-0.5" />
                    ) : (
                      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 border-line flex items-center justify-center">
                        <span className="w-1.5 h-0.5 bg-line rounded" />
                      </span>
                    )}
                    <span className={`text-sm ${feat.included ? 'text-text' : 'text-text-faint line-through'}`}>{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Plan comparison note */}
        <div className="mt-10 card p-5 bg-thread-bg/30 border-thread/20">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-thread shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-text mb-1">Why upgrade from Free?</p>
              <p className="text-xs text-text-muted leading-relaxed">
                The Free plan gives you one project with full manual access to every module. When you need
                <strong className="text-text"> AI to auto-generate artifacts</strong> from a description,
                <strong className="text-text"> a second project</strong>, or
                <strong className="text-text"> team collaboration</strong>, upgrade to Team.
                Enterprise adds SSO, IP allowlists, and advanced data isolation for security-conscious orgs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border-y border-line">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-ink tracking-tight mb-3">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  className="flex items-center justify-between w-full p-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-sm">{faq.q}</span>
                  <ChevronDown size={16} className={`text-text-muted shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-text-muted leading-relaxed animate-fade-in">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="card p-10 md:p-14 bg-gradient-to-br from-thread-bg to-card border-thread/20">
          <div className="w-14 h-14 rounded-2xl bg-thread flex items-center justify-center mx-auto mb-5">
            <Lock size={26} className="text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-3">Start your first project free</h2>
          <p className="text-text-muted text-lg mb-6 max-w-xl mx-auto">
            Join QA teams using Krayo to manage requirements, test cases, defects, and traceability — all in one place.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button className="btn btn-primary text-base px-6 py-2.5" onClick={() => navigate('/signup')}>
              Get started free <ArrowRight size={17} />
            </button>
            <button className="btn btn-ghost text-base px-5 py-2.5" onClick={() => navigate(user ? '/app' : '/signin')}>
              {user ? 'Go to app' : 'Sign in'}
            </button>
          </div>
          <p className="text-xs text-text-faint mt-4">No credit card required · Free forever · Upgrade anytime</p>
        </div>
      </section>

      <ContactSalesModal open={showSalesModal} onClose={() => setShowSalesModal(false)} />

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <KrayoLogo size={18} /> Krayo
          </div>
          <div className="flex items-center gap-4 text-xs text-text-faint">
            <Link to="/terms" className="hover:text-text transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-text transition-colors">Privacy</Link>
            <Link to="/security" className="hover:text-text transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
