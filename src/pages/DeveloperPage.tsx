import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Code2, Database, Terminal, BookOpen, KeyRound,
  ChevronDown, Copy, Check, Webhook, ListChecks,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { KrayoLogo } from '../components/Logo';
import { MODULES } from '../lib/types';

type Tab = 'overview' | 'crud' | 'howto' | 'webhooks';

const ENDPOINTS = MODULES.filter((m) => m.table).map((m) => ({
  label: m.label,
  table: m.table,
}));

const CRUD_EXAMPLES: Record<string, { fields: { name: string; type: string; desc: string }[] }> = {
  requirements: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. REQ-001)' },
      { name: 'title', type: 'text', desc: 'Short summary of the requirement' },
      { name: 'description', type: 'text', desc: 'Detailed description (optional)' },
      { name: 'category', type: 'text', desc: 'Functional, Non-Functional, Constraint, etc.' },
      { name: 'priority', type: 'text', desc: 'low | medium | high | critical' },
      { name: 'status', type: 'text', desc: 'draft | reviewed | approved | implemented' },
    ],
  },
  test_cases: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. TC-001)' },
      { name: 'title', type: 'text', desc: 'What the test verifies' },
      { name: 'requirement_id', type: 'uuid', desc: 'Linked requirement (optional)' },
      { name: 'cycle', type: 'text', desc: 'Test cycle name (e.g. Cycle 1, Regression)' },
      { name: 'steps', type: 'text', desc: 'Step-by-step test instructions' },
      { name: 'expected_result', type: 'text', desc: 'What a passing result looks like' },
      { name: 'status', type: 'text', desc: 'draft | ready | passed | failed | blocked' },
    ],
  },
  defects: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. DEF-001)' },
      { name: 'title', type: 'text', desc: 'Short defect summary' },
      { name: 'test_case_id', type: 'uuid', desc: 'Linked test case (optional)' },
      { name: 'severity', type: 'text', desc: 'low | medium | high | critical' },
      { name: 'description', type: 'text', desc: 'Steps to reproduce, environment details' },
      { name: 'status', type: 'text', desc: 'open | in_progress | resolved | closed' },
    ],
  },
  action_items: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. AI-001)' },
      { name: 'title', type: 'text', desc: 'What needs to be done' },
      { name: 'owner', type: 'text', desc: 'Owner name (optional)' },
      { name: 'owner_user_id', type: 'uuid', desc: 'Linked user ID (optional)' },
      { name: 'due_date', type: 'date', desc: 'When the item is due (optional)' },
      { name: 'status', type: 'text', desc: 'open | in_progress | done | cancelled' },
      { name: 'notes', type: 'text', desc: 'Additional context (optional)' },
    ],
  },
  decisions: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. DEC-001)' },
      { name: 'title', type: 'text', desc: 'Decision summary' },
      { name: 'requirement_id', type: 'uuid', desc: 'Linked requirement (optional)' },
      { name: 'description', type: 'text', desc: 'Rationale and context' },
      { name: 'decided_by', type: 'text', desc: 'Who made the decision' },
      { name: 'decision_date', type: 'date', desc: 'When it was decided' },
    ],
  },
  raid_entries: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. RSK-001)' },
      { name: 'title', type: 'text', desc: 'Short summary' },
      { name: 'type', type: 'text', desc: 'risk | assumption | issue | dependency' },
      { name: 'description', type: 'text', desc: 'Detailed description' },
      { name: 'owner', type: 'text', desc: 'Who owns this entry' },
      { name: 'status', type: 'text', desc: 'open | mitigated | closed' },
    ],
  },
  job_aids: {
    fields: [
      { name: 'code', type: 'text', desc: 'Unique identifier (e.g. JA-001)' },
      { name: 'title', type: 'text', desc: 'Title of the job aid' },
      { name: 'description', type: 'text', desc: 'What it covers' },
      { name: 'url', type: 'text', desc: 'Link to the resource (optional)' },
    ],
  },
  resource_allocations: {
    fields: [
      { name: 'user_id', type: 'uuid', desc: 'User being allocated' },
      { name: 'hours_per_week', type: 'number', desc: 'Allocated hours per week' },
      { name: 'start_date', type: 'date', desc: 'Allocation start date' },
      { name: 'end_date', type: 'date', desc: 'Allocation end date' },
      { name: 'role', type: 'text', desc: 'Role on the project (optional)' },
      { name: 'notes', type: 'text', desc: 'Additional notes (optional)' },
    ],
  },
  project_milestones: {
    fields: [
      { name: 'name', type: 'text', desc: 'Milestone name' },
      { name: 'description', type: 'text', desc: 'Details (optional)' },
      { name: 'phase', type: 'text', desc: 'Planning | Design | Build | Test | Deploy' },
      { name: 'planned_start', type: 'date', desc: 'Planned start date (optional)' },
      { name: 'planned_end', type: 'date', desc: 'Planned end date (optional)' },
      { name: 'status', type: 'text', desc: 'not_started | in_progress | completed | delayed' },
      { name: 'owner', type: 'text', desc: 'Owner name (optional)' },
      { name: 'progress', type: 'number', desc: '0–100 percentage' },
    ],
  },
};

const HOW_TO_GUIDES = [
  {
    title: 'Authenticate with Supabase',
    icon: KeyRound,
    steps: [
      'Sign up via POST /auth/v1/signup with email and password to receive a session token.',
      'Store the access_token from the response in your client (e.g. localStorage or a cookie).',
      'Include the token as a Bearer token in the Authorization header on every API call.',
      'Use the service role key only server-side — never expose it in client code.',
    ],
    code: `// JavaScript — sign in and get a session
const res = await fetch(
  \`\${SUPABASE_URL}/auth/v1/token?grant_type=password\`,
  {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  }
);
const { access_token } = await res.json();`,
  },
  {
    title: 'Create a project',
    icon: Database,
    steps: [
      'Obtain an authenticated session token (see the authentication guide).',
      'POST to /rest/v1/projects with the org_id and a name for your project.',
      'The response includes the new project UUID — use it as project_id in all subsequent CRUD calls.',
    ],
    code: `const res = await fetch(
  \`\${SUPABASE_URL}/rest/v1/projects\`,
  {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      org_id: orgId,
      name: 'My QA Project',
      description: 'Testing the payment flow',
    }),
  }
);
const [project] = await res.json();
console.log(project.id);`,
  },
  {
    title: 'Bulk import requirements via CSV',
    icon: ListChecks,
    steps: [
      'Prepare a CSV file with columns: code, title, description, category, priority, status.',
      'Parse the CSV client-side (or server-side) into an array of JSON objects.',
      'POST the array to /rest/v1/requirements with Prefer: return=representation.',
      'Each row must include project_id — scope it to the correct project.',
    ],
    code: `const rows = parseCSV(csvFile); // [{code, title, ...}, ...]
const payload = rows.map(r => ({ ...r, project_id: projectId }));

await fetch(\`\${SUPABASE_URL}/rest/v1/requirements\`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': \`Bearer \${access_token}\`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },
  body: JSON.stringify(payload),
});`,
  },
  {
    title: 'Trigger AI generation',
    icon: Webhook,
    steps: [
      'Call the ai-generate edge function with a project description and module type.',
      'The function returns drafted artifacts (requirements, test cases, etc.) as JSON.',
      'Review the output, then insert approved items via the standard CRUD endpoints.',
    ],
    code: `const res = await fetch(
  \`\${SUPABASE_URL}/functions/v1/ai-generate\`,
  {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      module: 'requirements',
      projectId: projectId,
      prompt: 'E-commerce checkout with Stripe and Apple Pay',
    }),
  }
);
const { artifacts } = await res.json();`,
  },
];

function crudListCode(ep: string) {
  return 'fetch(\n' +
    '  `${URL}/rest/v1/' + ep + '` +\n' +
    '    `?project_id=eq.${projectId}` +\n' +
    '    `&order=created_at.desc`,\n' +
    '  { headers: { apikey, Authorization } }\n' +
    ')';
}

function crudCreateCode(ep: string) {
  return 'fetch(\n' +
    '  `${URL}/rest/v1/' + ep + '`,\n' +
    '  {\n' +
    '    method: \'POST\',\n' +
    '    headers: {\n' +
    '      apikey, Authorization,\n' +
    '      \'Content-Type\': \'application/json\',\n' +
    '      \'Prefer\': \'return=representation\',\n' +
    '    },\n' +
    '    body: JSON.stringify({\n' +
    '      project_id: projectId,\n' +
    '      code: \'REQ-001\',\n' +
    '      title: \'Login flow\',\n' +
    '      // ...fields\n' +
    '    }),\n' +
    '  }\n' +
    ')';
}

function crudUpdateCode(ep: string) {
  return 'fetch(\n' +
    '  `${URL}/rest/v1/' + ep + '` +\n' +
    '    `?id=eq.${id}`,\n' +
    '  {\n' +
    '    method: \'PATCH\',\n' +
    '    headers: {\n' +
    '      apikey, Authorization,\n' +
    '      \'Content-Type\': \'application/json\',\n' +
    '    },\n' +
    '    body: JSON.stringify({ status: \'approved\' }),\n' +
    '  }\n' +
    ')';
}

function crudDeleteCode(ep: string) {
  return 'fetch(\n' +
    '  `${URL}/rest/v1/' + ep + '` +\n' +
    '    `?id=eq.${id}`,\n' +
    '  {\n' +
    '    method: \'DELETE\',\n' +
    '    headers: { apikey, Authorization },\n' +
    '  }\n' +
    ')';
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-line/50 hover:bg-line transition-colors opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        {copied ? <Check size={14} className="text-thread" /> : <Copy size={14} className="text-text-muted" />}
      </button>
      <pre className="bg-ink text-paper/90 text-xs leading-relaxed rounded-lg p-4 overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DeveloperPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [activeEndpoint, setActiveEndpoint] = useState(ENDPOINTS[0]?.table ?? 'requirements');
  const [openGuide, setOpenGuide] = useState<number | null>(0);

  const activeFields = CRUD_EXAMPLES[activeEndpoint]?.fields ?? [];

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
            <button className="px-3 py-1.5 text-sm font-semibold text-ink bg-thread-bg rounded-md">Developer</button>
            <button className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text rounded-md transition-colors" onClick={() => navigate('/blog')}>Blog</button>
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
          <button className="flex-1 py-2.5 text-xs font-semibold text-ink bg-thread-bg">Developer</button>
          <button className="flex-1 py-2.5 text-xs font-medium text-text-muted" onClick={() => navigate('/blog')}>Blog</button>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-thread-bg text-thread text-xs font-medium mb-5">
          <Code2 size={13} /> Developer Documentation
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-ink tracking-tight mb-4">Build on Krayo</h1>
        <p className="text-lg text-text-muted max-w-2xl leading-relaxed mb-8">
          Krayo is built on Supabase (PostgreSQL + REST API + Edge Functions). Every module — requirements,
          test cases, defects, RAID, and more — is a standard database table you can read and write via the REST API.
        </p>

        {/* Sub-tabs */}
        <div className="flex gap-1 border-b border-line">
          {([
            { key: 'overview', label: 'Overview', icon: BookOpen },
            { key: 'crud', label: 'CRUD Reference', icon: Database },
            { key: 'howto', label: 'How-To Guides', icon: Terminal },
            { key: 'webhooks', label: 'Edge Functions', icon: Webhook },
          ] as { key: Tab; label: string; icon: typeof BookOpen }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-thread text-thread'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Content */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-bold mb-3">Architecture at a glance</h2>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  Krayo uses Supabase as its backend. Every CRUD module maps directly to a PostgreSQL table
                  exposed through the PostgREST auto-generated API at <code className="text-xs bg-thread-bg/50 px-1.5 py-0.5 rounded">/rest/v1/&lt;table&gt;</code>.
                  Authentication is handled by Supabase Auth (email/password). AI generation runs as a serverless
                  Edge Function. Row-level security policies enforce that users can only access data within their
                  organization and project memberships.
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'Base URL', value: 'https://<your-project>.supabase.co' },
                    { label: 'REST API', value: '/rest/v1/<table>' },
                    { label: 'Auth', value: '/auth/v1/' },
                    { label: 'Edge Functions', value: '/functions/v1/<slug>' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-line/50 last:border-0">
                      <span className="text-sm font-medium text-text">{row.label}</span>
                      <code className="text-xs bg-thread-bg/50 text-thread px-2 py-1 rounded">{row.value}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-bold mb-3">Available endpoints</h2>
                <p className="text-sm text-text-muted mb-4">Each module table supports full CRUD operations.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ENDPOINTS.map((ep) => (
                    <button
                      key={ep.table}
                      onClick={() => { setTab('crud'); setActiveEndpoint(ep.table); }}
                      className="flex items-center justify-between p-3 rounded-lg border border-line hover:border-thread/30 hover:bg-thread-bg/20 transition-all text-left"
                    >
                      <span className="text-sm font-medium">{ep.label}</span>
                      <code className="text-xs text-text-muted">{ep.table}</code>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><KeyRound size={16} className="text-thread" /> Authentication</h3>
                <p className="text-xs text-text-muted leading-relaxed mb-3">
                  All API requests require an <code className="text-xs bg-thread-bg/50 px-1 py-0.5 rounded">apikey</code> header
                  with your project's anon key, plus a <code className="text-xs bg-thread-bg/50 px-1 py-0.5 rounded">Authorization: Bearer &lt;token&gt;</code> header
                  for authenticated calls.
                </p>
                <CodeBlock code={`// Required headers
{
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}`} />
              </div>

              <div className="card p-6 bg-thread-bg/20 border-thread/20">
                <h3 className="text-sm font-bold mb-2">Row-Level Security</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Every table is protected by RLS policies. Users can only read and write data within
                  organizations they belong to and projects they are members of. The <code className="text-xs">auth.uid()</code> function
                  is used to verify ownership on every query.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'crud' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Endpoint selector */}
            <div className="lg:col-span-1">
              <div className="card p-4 lg:sticky lg:top-24">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">Tables</h3>
                <div className="space-y-1">
                  {ENDPOINTS.map((ep) => (
                    <button
                      key={ep.table}
                      onClick={() => setActiveEndpoint(ep.table)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        activeEndpoint === ep.table
                          ? 'bg-thread-bg text-thread font-semibold'
                          : 'text-text-muted hover:text-text hover:bg-card'
                      }`}
                    >
                      {ep.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CRUD detail */}
            <div className="lg:col-span-3 space-y-6">
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Database size={18} className="text-thread" />
                  <h2 className="text-lg font-bold">{ENDPOINTS.find((e) => e.table === activeEndpoint)?.label}</h2>
                </div>
                <code className="text-xs text-text-muted">{activeEndpoint}</code>
              </div>

              {/* Schema */}
              <div className="card p-6">
                <h3 className="text-sm font-bold mb-4">Schema fields</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="text-left py-2 pr-4 font-semibold text-text-muted text-xs uppercase tracking-wide">Field</th>
                        <th className="text-left py-2 pr-4 font-semibold text-text-muted text-xs uppercase tracking-wide">Type</th>
                        <th className="text-left py-2 font-semibold text-text-muted text-xs uppercase tracking-wide">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFields.map((f) => (
                        <tr key={f.name} className="border-b border-line/50 last:border-0">
                          <td className="py-2.5 pr-4"><code className="text-xs font-mono text-thread">{f.name}</code></td>
                          <td className="py-2.5 pr-4"><span className="text-xs text-text-muted">{f.type}</span></td>
                          <td className="py-2.5 text-xs text-text-muted">{f.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Operations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-bg text-green">GET</span>
                    <span className="text-sm font-semibold">List / Filter</span>
                  </div>
                  <CodeBlock code={crudListCode(activeEndpoint)} />
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-bg text-blue">POST</span>
                    <span className="text-sm font-semibold">Create</span>
                  </div>
                  <CodeBlock code={crudCreateCode(activeEndpoint)} />
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-bg text-amber">PATCH</span>
                    <span className="text-sm font-semibold">Update</span>
                  </div>
                  <CodeBlock code={crudUpdateCode(activeEndpoint)} />
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-bg text-red">DELETE</span>
                    <span className="text-sm font-semibold">Delete</span>
                  </div>
                  <CodeBlock code={crudDeleteCode(activeEndpoint)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'howto' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {HOW_TO_GUIDES.map((guide, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  className="flex items-center justify-between w-full p-5 text-left"
                  onClick={() => setOpenGuide(openGuide === i ? null : i)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-thread-bg flex items-center justify-center">
                      <guide.icon size={18} className="text-thread" />
                    </div>
                    <span className="font-semibold text-sm">{guide.title}</span>
                  </div>
                  <ChevronDown size={18} className={`text-text-muted shrink-0 transition-transform ${openGuide === i ? 'rotate-180' : ''}`} />
                </button>
                {openGuide === i && (
                  <div className="px-5 pb-5 animate-fade-in">
                    <ol className="space-y-2.5 mb-4">
                      {guide.steps.map((step, si) => (
                        <li key={si} className="flex items-start gap-3">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-thread-bg text-thread text-xs font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                          <span className="text-sm text-text-muted leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <CodeBlock code={guide.code} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'webhooks' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Webhook size={18} className="text-thread" />
                <h2 className="text-lg font-bold">Edge Functions</h2>
              </div>
              <p className="text-sm text-text-muted leading-relaxed mb-4">
                Krayo uses Supabase Edge Functions (Deno-based serverless functions) for server-side logic
                that should not run in the browser. Each function is invoked via HTTP at
                <code className="text-xs bg-thread-bg/50 px-1.5 py-0.5 rounded mx-1">/functions/v1/&lt;slug&gt;</code>
                and requires an Authorization header.
              </p>
            </div>

            {[
              { slug: 'ai-generate', method: 'POST', desc: 'Generates requirements, test cases, defects, or RAID entries from a natural-language prompt. Returns drafted artifacts as JSON for review.' },
              { slug: 'send-notification', method: 'POST', desc: 'Creates in-app notifications and optionally sends email via Resend. Supports mention and assignment notification types with user preference checks.' },
              { slug: 'send-verification-email', method: 'POST', desc: 'Sends a verification email with a signed token when a user signs up or requests email verification.' },
              { slug: 'verify-email', method: 'POST', desc: 'Validates a verification token and marks the user\'s email as confirmed in the database.' },
              { slug: 'stripe-checkout', method: 'POST', desc: 'Creates a Stripe Checkout session for plan upgrades (Team or Enterprise). Returns a checkout URL for redirect.' },
              { slug: 'stripe-portal', method: 'POST', desc: 'Creates a Stripe Customer Portal session so users can manage their subscription, update payment methods, or cancel.' },
              { slug: 'stripe-webhook', method: 'POST', desc: 'Receives Stripe webhook events (checkout completed, subscription updated, etc.) and syncs the org plan and billing status. Sends confirmation emails on upgrade.' },
              { slug: 'user-lookup', method: 'POST', desc: 'Looks up users by email for invitations and membership management. Returns user display name and ID if found.' },
              { slug: 'auto-confirm-user', method: 'POST', desc: 'Server-side helper that confirms a user account after email verification, using the service role key.' },
            ].map((fn) => (
              <div key={fn.slug} className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${fn.method === 'POST' ? 'bg-blue-bg text-blue' : 'bg-green-bg text-green'}`}>{fn.method}</span>
                  <code className="text-sm font-mono text-thread">/functions/v1/{fn.slug}</code>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{fn.desc}</p>
              </div>
            ))}

            <div className="card p-6">
              <h3 className="text-sm font-bold mb-3">Example: calling an edge function</h3>
              <CodeBlock code={`const res = await fetch(
  \`\${SUPABASE_URL}/functions/v1/ai-generate\`,
  {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      module: 'testcases',
      projectId: projectId,
      prompt: 'Generate test cases for the login flow',
    }),
  }
);
const { artifacts } = await res.json();
// artifacts is an array of drafted test cases
// Review, then insert via POST /rest/v1/test_cases`} />
            </div>
          </div>
        )}
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
