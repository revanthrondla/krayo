import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Clock, Tag, Check, X,
  Sparkles, Network, ShieldAlert, BarChart3, Zap, Lock,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { KrayoLogo } from '../components/Logo';

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  icon: typeof Sparkles;
  content: { heading: string; body: string }[];
}

const POSTS: BlogPost[] = [
  {
    slug: 'krayo-vs-jira',
    title: 'Krayo vs Jira: Why QA Teams Are Switching',
    excerpt: 'Jira is a general-purpose issue tracker. Krayo is purpose-built for QA — with requirements traceability, test case management, and AI-generated artifacts out of the box.',
    category: 'Comparison',
    readTime: '6 min read',
    date: 'Aug 2026',
    icon: Network,
    content: [
      {
        heading: 'The problem with Jira for QA',
        body: 'Jira started as a bug tracker and grew into a general-purpose project management tool. QA teams using Jira typically bolt on Confluence for requirements, Zephyr for test cases, and a separate spreadsheet for traceability. The result: data scattered across three tools, no live traceability matrix, and manual cross-referencing that breaks the moment someone forgets to link a ticket.',
      },
      {
        heading: 'Krayo keeps everything threaded',
        body: 'Krayo was built from the ground up for QA project management. Requirements link to test cases, test cases link to defects, and the Requirements Traceability Matrix updates live — no manual cross-referencing. Every artifact lives in one project, one database, one source of truth.',
      },
      {
        heading: 'AI generation changes the game',
        body: 'With Jira, you start from a blank ticket. With Krayo, you describe your project in plain English and AI drafts your requirements, test cases, defects, and RAID entries — ready for your review. Nothing is added without your sign-off, but you skip the blank-page problem entirely.',
      },
      {
        heading: 'The bottom line',
        body: 'If your team spends hours cross-referencing tickets across Jira, Confluence, and Zephyr, Krayo eliminates that overhead. One tool, full traceability, AI-assisted artifact generation, and an executive dashboard built for steering committees — not sprint planning.',
      },
    ],
  },
  {
    slug: 'krayo-vs-testrail',
    title: 'Krayo vs TestRail: Beyond Test Case Management',
    excerpt: 'TestRail handles test cases well, but stops there. Krayo covers the full QA lifecycle — from requirements to defects to executive reporting — with AI generation built in.',
    category: 'Comparison',
    readTime: '5 min read',
    date: 'Aug 2026',
    icon: BarChart3,
    content: [
      {
        heading: 'TestRail is a test case tool, not a QA platform',
        body: 'TestRail excels at authoring and running test cases. But QA teams need more: requirements management, defect tracking, RAID logs, decisions, action items, and executive dashboards. With TestRail, you still need Jira for defects, a separate tool for requirements, and a spreadsheet for your traceability matrix.',
      },
      {
        heading: 'Krayo covers the full lifecycle',
        body: 'Krayo includes test case management with steps, expected results, and execution cycles — but it also includes requirements, defects, RAID logs, decisions, action items, job aids, resource allocation, and an executive dashboard. All connected. All in one place.',
      },
      {
        heading: 'AI vs manual authoring',
        body: 'TestRail requires manual authoring of every test case. Krayo\'s AI generation can draft an entire test suite from a project description, then you review and approve. For a new project, this can save days of manual work.',
      },
      {
        heading: 'The bottom line',
        body: 'TestRail is excellent if you only need test case management and already have the rest of your toolchain sorted. But if you want a single platform that handles the entire QA lifecycle — with AI to accelerate artifact creation — Krayo is the better choice.',
      },
    ],
  },
  {
    slug: 'krayo-vs-zephyr',
    title: 'Krayo vs Zephyr Scale: Escaping the Jira Tax',
    excerpt: 'Zephyr Scale is a Jira plugin for test management. It inherits Jira\'s limitations and adds a per-user license cost on top. Krayo replaces both with a purpose-built QA platform.',
    category: 'Comparison',
    readTime: '5 min read',
    date: 'Aug 2026',
    icon: ShieldAlert,
    content: [
      {
        heading: 'The Jira plugin problem',
        body: 'Zephyr Scale runs inside Jira, which means your test data is locked behind Jira\'s issue model. Test cases become issues, test cycles become sprints, and traceability requires linking issues to issues. You also pay for Jira licenses plus Zephyr licenses — double the cost per user.',
      },
      {
        heading: 'Krayo is independent and integrated',
        body: 'Krayo is a standalone platform with its own data model designed for QA. Test cases are first-class citizens, not issues in disguise. The traceability matrix is a native view, not a JQL query. And you pay one price per seat — no plugin stacking.',
      },
      {
        heading: 'AI generation included',
        body: 'Zephyr has no AI generation. Every test case is authored manually. Krayo\'s AI can draft test cases from a requirement or project description, cutting authoring time dramatically.',
      },
      {
        heading: 'The bottom line',
        body: 'If you are already locked into Jira and just need basic test management, Zephyr Scale works. But if you want a QA platform that treats test cases, requirements, and defects as connected artifacts — with AI generation and no Jira tax — Krayo is the upgrade.',
      },
    ],
  },
  {
    slug: 'krayo-vs-practitest',
    title: 'Krayo vs PractiTest: AI Generation and Simpler Pricing',
    excerpt: 'PractiTest offers solid test management but lacks AI generation and charges per user with complex pricing. Krayo adds AI, transparent pricing, and a broader module set.',
    category: 'Comparison',
    readTime: '4 min read',
    date: 'Aug 2026',
    icon: Sparkles,
    content: [
      {
        heading: 'PractiTest covers the basics',
        body: 'PractiTest is a capable test management tool with requirements, test cases, and runs. It is a step up from spreadsheets, but it stops at test management. There is no RAID log, no decisions module, no job aids, and no executive dashboard designed for steering committees.',
      },
      {
        heading: 'Krayo goes further',
        body: 'Krayo includes everything PractiTest covers plus RAID logs, decisions, action items, job aids, resource allocation, and a project-level security settings panel. And it does so with AI generation that can draft any artifact from a description.',
      },
      {
        heading: 'Pricing transparency',
        body: 'PractiTest\'s pricing requires contacting sales and varies by user count and feature tier. Krayo has three plans with clear per-seat pricing: Free forever, $49/seat for Team with AI, and $199/seat for Enterprise with SSO and security controls. No sales calls required.',
      },
      {
        heading: 'The bottom line',
        body: 'PractiTest is a reasonable choice for test-only teams. But if you want AI generation, a broader set of QA modules, and pricing you can see before signing up, Krayo is the stronger pick.',
      },
    ],
  },
  {
    slug: 'krayo-vs-xray',
    title: 'Krayo vs Xray: From Jira Plugin to QA Platform',
    excerpt: 'Xray is another Jira plugin for test management. Like Zephyr, it inherits Jira\'s constraints. Krayo offers a standalone alternative with AI, full traceability, and no Jira dependency.',
    category: 'Comparison',
    readTime: '4 min read',
    date: 'Aug 2026',
    icon: Network,
    content: [
      {
        heading: 'Xray is powerful but Jira-bound',
        body: 'Xray is a mature test management plugin for Jira with support for BDD, test plans, and test executions. But it lives entirely within Jira. Your test data is modeled as Jira issues, your reporting uses Jira dashboards, and your traceability depends on issue links. You also need Jira licenses for every user.',
      },
      {
        heading: 'Krayo is built for QA, not retrofitted',
        body: 'Krayo has its own data model where test cases, requirements, and defects are distinct entities with proper relationships. The traceability matrix is a native, live view — not a set of Jira issue links you have to maintain manually. And there is no Jira license requirement.',
      },
      {
        heading: 'AI generation is the differentiator',
        body: 'Xray has no AI features. Krayo can generate test cases, requirements, and defects from a project description. For teams starting a new project or onboarding a new feature, this eliminates the blank-page problem and accelerates time to first test run.',
      },
      {
        heading: 'The bottom line',
        body: 'Xray is a good choice if your organization is deeply invested in Jira and needs BDD support. But if you want a standalone QA platform with AI generation, native traceability, and no Jira dependency, Krayo is the better path forward.',
      },
    ],
  },
  {
    slug: 'why-ai-changes-qa',
    title: 'How AI Generation Is Changing QA Project Management',
    excerpt: 'Manual artifact creation is the biggest time sink in QA. AI generation eliminates the blank-page problem and lets QA teams focus on review, execution, and reporting.',
    category: 'Insights',
    readTime: '5 min read',
    date: 'Aug 2026',
    icon: Zap,
    content: [
      {
        heading: 'The blank-page problem',
        body: 'Every QA project starts the same way: a blank document. Someone has to write the first requirement, the first test case, the first defect report. This manual authoring is the single biggest time sink in project setup, and it is where most teams lose momentum.',
      },
      {
        heading: 'AI as a first draft, not a replacement',
        body: 'Krayo\'s AI generation does not replace QA judgment — it accelerates it. You describe your project in plain English, and the AI drafts requirements, test cases, defects, and RAID entries. You review, edit, and approve. Nothing is added without your sign-off. The AI handles the blank page; you handle the quality.',
      },
      {
        heading: 'Where it saves the most time',
        body: 'Teams report the biggest time savings in three areas: starting a new project (AI drafts the full artifact set in seconds), onboarding a new feature (AI generates test cases from the feature description), and filling gaps (AI suggests requirements or test cases you might have missed).',
      },
      {
        heading: 'The future of QA tooling',
        body: 'AI generation is becoming table stakes for QA platforms. Tools that require purely manual authoring will feel increasingly slow. Krayo is built AI-first — every module has an AI Generate button — so your team can move at the speed of your review process, not the speed of your typing.',
      },
    ],
  },
];

const COMPARISON_TABLE = [
  { feature: 'Requirements management', krayo: true, jira: 'Via Confluence', testrail: false, zephyr: false, xray: false, practitest: true },
  { feature: 'Test case management', krayo: true, jira: 'Via Zephyr/Xray', testrail: true, zephyr: true, xray: true, practitest: true },
  { feature: 'Defect tracking', krayo: true, jira: true, testrail: false, zephyr: false, xray: false, practitest: 'Basic' },
  { feature: 'Live traceability matrix', krayo: true, jira: false, testrail: 'Manual', zephyr: false, xray: 'Issue links', practitest: 'Manual' },
  { feature: 'RAID log', krayo: true, jira: false, testrail: false, zephyr: false, xray: false, practitest: false },
  { feature: 'Decisions & action items', krayo: true, jira: 'As issues', testrail: false, zephyr: false, xray: false, practitest: false },
  { feature: 'Executive dashboard', krayo: true, jira: 'Via plugins', testrail: 'Basic', zephyr: false, xray: 'Basic', practitest: 'Basic' },
  { feature: 'AI artifact generation', krayo: true, jira: false, testrail: false, zephyr: false, xray: false, practitest: false },
  { feature: 'CSV import & export', krayo: true, jira: true, testrail: true, zephyr: true, xray: true, practitest: true },
  { feature: 'Row-level security', krayo: true, jira: 'Project-level', testrail: false, zephyr: 'Via Jira', xray: 'Via Jira', practitest: false },
  { feature: 'SSO & IP allowlisting', krayo: 'Enterprise', jira: 'Premium', testrail: 'Add-on', zephyr: 'Via Jira', xray: 'Via Jira', practitest: 'Add-on' },
  { feature: 'Standalone (no Jira required)', krayo: true, jira: '—', testrail: true, zephyr: false, xray: false, practitest: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={16} className="text-thread mx-auto" />;
  if (value === false) return <X size={14} className="text-text-faint mx-auto" />;
  return <span className="text-xs text-text-muted">{value}</span>;
}

export function BlogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activePost, setActivePost] = useState<number | null>(null);

  if (activePost !== null) {
    const post = POSTS[activePost];
    const PostIcon = post.icon;
    return (
      <div className="min-h-screen bg-paper">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <button className="flex items-center gap-2 font-bold text-base" onClick={() => navigate('/')}>
              <KrayoLogo size={22} /> Krayo
            </button>
            <div className="hidden sm:flex items-center gap-1">
              <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/')}>Product</button>
              <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/developer')}>Developer</button>
              <button className="px-3 py-1.5 text-sm font-semibold text-ink bg-thread-bg rounded-md">Blog</button>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(user ? '/app' : '/signin')}>
                {user ? 'Go to app' : 'Sign in'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/signup')}>
                Get started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-16">
          <button onClick={() => setActivePost(null)} className="flex items-center gap-2 text-sm text-text-muted hover:text-text mb-8 transition-colors">
            <ArrowLeft size={16} /> Back to blog
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-thread-bg flex items-center justify-center">
              <PostIcon size={20} className="text-thread" />
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Tag size={12} /> {post.category}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
              <span>·</span>
              <span>{post.date}</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink tracking-tight mb-4">{post.title}</h1>
          <p className="text-lg text-text-muted leading-relaxed mb-8">{post.excerpt}</p>
          <div className="space-y-8">
            {post.content.map((section, i) => (
              <div key={i}>
                <h2 className="text-xl font-bold text-ink mb-3">{section.heading}</h2>
                <p className="text-base text-text-muted leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          {activePost! < 4 && (
            <div className="mt-12 pt-8 border-t border-line">
              <h3 className="text-sm font-bold mb-4">Feature comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="text-left py-2 pr-4 font-semibold text-text-muted text-xs uppercase tracking-wide">Feature</th>
                      <th className="py-2 px-2 font-semibold text-thread text-xs uppercase tracking-wide">Krayo</th>
                      <th className="py-2 px-2 font-semibold text-text-muted text-xs">Jira</th>
                      <th className="py-2 px-2 font-semibold text-text-muted text-xs">TestRail</th>
                      <th className="py-2 px-2 font-semibold text-text-muted text-xs">Zephyr</th>
                      <th className="py-2 px-2 font-semibold text-text-muted text-xs">Xray</th>
                      <th className="py-2 px-2 font-semibold text-text-muted text-xs">PractiTest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_TABLE.map((row) => (
                      <tr key={row.feature} className="border-b border-line/50 last:border-0">
                        <td className="py-2.5 pr-4 text-xs font-medium text-text">{row.feature}</td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.krayo} /></td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.jira} /></td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.testrail} /></td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.zephyr} /></td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.xray} /></td>
                        <td className="py-2.5 px-2 text-center"><Cell value={row.practitest} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-12 card p-8 bg-gradient-to-br from-thread-bg to-card border-thread/20 text-center">
            <h3 className="text-xl font-bold mb-2">Ready to try Krayo?</h3>
            <p className="text-sm text-text-muted mb-5">Start free, no credit card required. Upgrade when you need AI generation or team collaboration.</p>
            <button className="btn btn-primary" onClick={() => navigate('/signup')}>
              Get started free <ArrowRight size={16} />
            </button>
          </div>
        </article>

        <footer className="border-t border-line">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <KrayoLogo size={18} /> Krayo
            </div>
            <p className="text-xs text-text-faint">QA project management, threaded together.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <button className="flex items-center gap-2 font-bold text-base" onClick={() => navigate('/')}>
            <KrayoLogo size={22} /> Krayo
          </button>
          <div className="hidden sm:flex items-center gap-1">
            <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/')}>Product</button>
            <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/developer')}>Developer</button>
            <button className="px-3 py-1.5 text-sm font-semibold text-ink bg-thread-bg rounded-md">Blog</button>
          </div>
          <div className="flex items-center gap-2">
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
          <button className="flex-1 py-2.5 text-xs font-medium text-text-muted" onClick={() => navigate('/')}>Product</button>
          <button className="flex-1 py-2.5 text-xs font-medium text-text-muted" onClick={() => navigate('/developer')}>Developer</button>
          <button className="flex-1 py-2.5 text-xs font-semibold text-ink bg-thread-bg">Blog</button>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-thread-bg text-thread text-xs font-medium mb-5">
          <Sparkles size={13} /> Krayo Blog
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-ink tracking-tight mb-4">
          Comparisons, insights, and why teams choose Krayo
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
          Honest comparisons with the tools you are probably using today — and why Krayo is the better choice for QA teams.
        </p>
      </section>

      {/* Comparison table */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold mb-1">Feature comparison at a glance</h2>
          <p className="text-sm text-text-muted mb-5">How Krayo stacks up against the most popular QA and project management tools.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-3 pr-4 font-semibold text-text-muted text-xs uppercase tracking-wide">Feature</th>
                  <th className="py-3 px-2 font-semibold text-thread text-xs uppercase tracking-wide">Krayo</th>
                  <th className="py-3 px-2 font-semibold text-text-muted text-xs">Jira</th>
                  <th className="py-3 px-2 font-semibold text-text-muted text-xs">TestRail</th>
                  <th className="py-3 px-2 font-semibold text-text-muted text-xs">Zephyr</th>
                  <th className="py-3 px-2 font-semibold text-text-muted text-xs">Xray</th>
                  <th className="py-3 px-2 font-semibold text-text-muted text-xs">PractiTest</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.map((row) => (
                  <tr key={row.feature} className="border-b border-line/50 last:border-0 hover:bg-thread-bg/10 transition-colors">
                    <td className="py-3 pr-4 text-xs font-medium text-text">{row.feature}</td>
                    <td className="py-3 px-2 text-center bg-thread-bg/20"><Cell value={row.krayo} /></td>
                    <td className="py-3 px-2 text-center"><Cell value={row.jira} /></td>
                    <td className="py-3 px-2 text-center"><Cell value={row.testrail} /></td>
                    <td className="py-3 px-2 text-center"><Cell value={row.zephyr} /></td>
                    <td className="py-3 px-2 text-center"><Cell value={row.xray} /></td>
                    <td className="py-3 px-2 text-center"><Cell value={row.practitest} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Blog grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-ink mb-6">Latest articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {POSTS.map((post, i) => {
            const PostIcon = post.icon;
            return (
              <button
                key={post.slug}
                onClick={() => { setActivePost(i); window.scrollTo(0, 0); }}
                className="card p-6 text-left hover:border-thread/30 hover:shadow-md transition-all group flex flex-col"
              >
                <div className="w-10 h-10 rounded-xl bg-thread-bg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <PostIcon size={20} className="text-thread" />
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                  <span className="flex items-center gap-1"><Tag size={11} /> {post.category}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {post.readTime}</span>
                </div>
                <h3 className="font-bold text-base mb-2 group-hover:text-thread transition-colors">{post.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed flex-1">{post.excerpt}</p>
                <div className="flex items-center gap-1 text-xs text-thread font-semibold mt-4 group-hover:gap-2 transition-all">
                  Read more <ArrowRight size={13} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <div className="card p-10 md:p-14 bg-gradient-to-br from-thread-bg to-card border-thread/20">
          <div className="w-14 h-14 rounded-2xl bg-thread flex items-center justify-center mx-auto mb-5">
            <Lock size={26} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-ink tracking-tight mb-3">Switch to Krayo</h2>
          <p className="text-text-muted text-lg mb-6 max-w-xl mx-auto">
            Full traceability, AI-generated artifacts, and every QA module in one platform. Start free today.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button className="btn btn-primary text-base px-6 py-2.5" onClick={() => navigate('/signup')}>
              Get started free <ArrowRight size={17} />
            </button>
            <button className="btn btn-ghost text-base px-5 py-2.5" onClick={() => navigate('/')}>
              See features
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <KrayoLogo size={18} /> Krayo
          </div>
          <p className="text-xs text-text-faint">QA project management, threaded together.</p>
        </div>
      </footer>
    </div>
  );
}
