import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, Check, Clipboard, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck, Terminal, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, EmptyState } from '../../components/States';
import type { ProjectApiKey, TestRun, TestRunResult } from '../../lib/types';

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-junit-xml`;

export function TestRunsPage() {
  const { projectId, orgId } = useParams();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<ProjectApiKey | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestRunResult[]>>({});
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const [keyResponse, runsResponse] = await Promise.all([
      supabase.from('project_api_keys').select('id, project_id, key_prefix, last_used_at, created_at').eq('project_id', projectId).maybeSingle(),
      supabase.from('test_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ]);
    if (keyResponse.error || runsResponse.error) setError('Could not load automation details.');
    setApiKey((keyResponse.data as ProjectApiKey | null) ?? null);
    setRuns((runsResponse.data ?? []) as TestRun[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const generateKey = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('manage-automation-key', { body: { project_id: projectId } });
    if (invokeError || !data?.key) setError('Could not generate the API key.');
    else { setNewKey(data.key as string); await load(); }
    setGenerating(false);
  };

  const loadResults = async (runId: string) => {
    if (expandedRun === runId) { setExpandedRun(null); return; }
    if (!results[runId]) {
      const { data } = await supabase.from('test_run_results').select('*').eq('test_run_id', runId).order('created_at');
      setResults((current) => ({ ...current, [runId]: (data ?? []) as TestRunResult[] }));
    }
    setExpandedRun(runId);
  };

  const copy = async (value: string, name: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(name);
    setTimeout(() => setCopied(null), 1600);
  };

  if (loading) return <Loading label="Loading automation…" />;

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><Activity size={20} className="text-thread" /> Test Automation</h1><p className="text-sm text-text-muted mt-1">Connect your CI tools with JUnit XML. Krayo matches names like <code className="font-mono text-xs">TC-021</code> and updates test case status automatically.</p><p className="text-xs text-text-faint mt-2">Run manual checks directly in Krayo, or import results from your existing CI tools.</p></div>
        <div className="flex items-center gap-2"><button className="btn btn-primary btn-sm" onClick={() => navigate(`/app/orgs/${orgId}/projects/${projectId}/automation/execute`)}><Activity size={14} /> Run tests</button><button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button></div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"><X size={15} />{error}</div>}

      <section className="card p-5 mb-6">
        <div className="flex items-start gap-3 mb-4"><div className="w-9 h-9 rounded-xl bg-thread-bg flex items-center justify-center"><KeyRound size={18} className="text-thread" /></div><div><h2 className="font-semibold">Project API key</h2><p className="text-xs text-text-muted mt-0.5">Use this key from your CI pipeline. It is shown in full only once.</p></div></div>
        {newKey && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3"><div className="flex items-center justify-between gap-3"><code className="text-xs font-mono break-all text-green-800">{newKey}</code><button className="btn btn-ghost btn-sm shrink-0" onClick={() => copy(newKey, 'key')}>{copied === 'key' ? <Check size={14} /> : <Clipboard size={14} />}</button></div><p className="text-xs text-green-700 mt-2">Copy this key now. It will not be displayed again.</p></div>}
        <div className="flex items-center justify-between gap-3 flex-wrap"><div className="text-sm text-text-muted">{apiKey ? <><span className="font-mono text-text">{apiKey.key_prefix}••••••••</span><span className="ml-2 text-xs">Created {new Date(apiKey.created_at).toLocaleDateString()}</span></> : 'No API key has been created.'}</div><button className="btn btn-primary btn-sm" onClick={generateKey} disabled={generating}>{generating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><KeyRound size={14} /> {apiKey ? 'Replace key' : 'Generate API key'}</>}</button></div>
      </section>

      <section className="card p-5 mb-6">
        <div className="flex items-start gap-3 mb-4"><div className="w-9 h-9 rounded-xl bg-paper flex items-center justify-center"><Terminal size={18} className="text-text-muted" /></div><div><h2 className="font-semibold">JUnit XML endpoint</h2><p className="text-xs text-text-muted mt-0.5">POST the XML report after your automation suite finishes.</p></div></div>
        <div className="rounded-lg bg-ink p-4 text-xs text-white/80 font-mono overflow-x-auto"><div className="text-white/50 mb-2"># Example</div><div>curl -X POST \</div><div className="pl-4">-H <span className="text-green-300">"X-API-Key: YOUR_PROJECT_KEY"</span> \</div><div className="pl-4">-H <span className="text-green-300">"X-Report-URL: https://ci.example/report"</span> \</div><div className="pl-4">--data-binary @results.xml \</div><div className="pl-4 text-thread">{endpoint}</div></div>
        <p className="text-xs text-text-muted mt-3">Name automated tests with the matching test case code, such as <code className="font-mono">TC-021 — checkout with valid card</code>. Screenshots stay in your external CI report for now; native screenshot viewing and automatic defect drafts are planned for fast-follow.</p>
      </section>

      <section className="card overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between"><div><h2 className="font-semibold">Test runs</h2><p className="text-xs text-text-muted mt-0.5">{runs.length} recorded run{runs.length !== 1 ? 's' : ''}</p></div><ShieldCheck size={18} className="text-text-faint" /></div>
        {runs.length === 0 ? <div className="p-10"><EmptyState icon={Activity} title="No test runs yet" message="Start a hosted run now, or upload a JUnit report from your CI pipeline." /></div> : <div className="divide-y divide-line">{runs.map((run) => <RunRow key={run.id} run={run} expanded={expandedRun === run.id} results={results[run.id] ?? []} onToggle={() => loadResults(run.id)} />)}</div>}
      </section>
    </div>
  );
}

function RunRow({ run, expanded, results, onToggle }: { run: TestRun; expanded: boolean; results: TestRunResult[]; onToggle: () => void }) {
  return <div><button className="w-full p-4 text-left hover:bg-paper/60 transition-colors" onClick={onToggle}><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-semibold text-sm">{run.tool_name} run</span><span className="text-xs text-text-faint">{new Date(run.created_at).toLocaleString()}</span></div><div className="flex items-center gap-3 mt-2 text-xs"><span className="text-text-muted">{run.total_count} total</span><span className="text-green-600">{run.passed_count} passed</span><span className="text-red-600">{run.failed_count} failed</span><span className="text-orange-600">{run.skipped_count} skipped</span>{run.unmatched_count > 0 && <span className="text-text-muted">{run.unmatched_count} unmatched</span>}</div></div>{run.external_report_url && <a href={run.external_report_url} target="_blank" rel="noreferrer" className="text-thread hover:underline" onClick={(event) => event.stopPropagation()}><ExternalLink size={15} /></a>}</div></button>{expanded && <div className="bg-paper/60 border-t border-line px-4 pb-3">{results.map((result) => <div key={result.id} className="flex items-start justify-between gap-3 py-2 border-b border-line/60 last:border-0 text-xs"><div className="min-w-0"><p className="font-medium text-text truncate">{result.test_case_code ? `${result.test_case_code} — ` : ''}{result.incoming_name}</p>{result.failure_message && <p className="text-red-600 mt-0.5 truncate">{result.failure_message}</p>}</div><span className={result.outcome === 'passed' ? 'text-green-600' : result.outcome === 'skipped' ? 'text-orange-600' : 'text-red-600'}>{result.outcome}</span></div>)}</div>}</div>;
}
