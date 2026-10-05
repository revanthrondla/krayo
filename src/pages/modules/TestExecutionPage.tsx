import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Circle, ClipboardList, Loader2, Play, Save, SkipForward, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Loading, EmptyState } from '../../components/States';
import type { TestCase } from '../../lib/types';

type Outcome = 'passed' | 'failed' | 'skipped';
type ExecutionState = { outcome: Outcome | null; notes: string };

const statusLabels: Record<Outcome, string> = { passed: 'Passed', failed: 'Failed', skipped: 'Skipped' };

export function TestExecutionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [execution, setExecution] = useState<Record<string, ExecutionState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase.from('test_cases').select('*').eq('project_id', projectId).order('code').then(({ data, error: queryError }) => {
      if (queryError) setError('Could not load test cases.');
      const loaded = (data ?? []) as TestCase[];
      setCases(loaded);
      setSelected(loaded.map((testCase) => testCase.id));
      setExecution(Object.fromEntries(loaded.map((testCase) => [testCase.id, { outcome: null, notes: '' }])));
      setLoading(false);
    });
  }, [projectId]);

  const selectedCases = useMemo(() => selected.map((id) => cases.find((testCase) => testCase.id === id)).filter((testCase): testCase is TestCase => Boolean(testCase)), [cases, selected]);
  const currentCase = selectedCases[currentIndex];
  const currentExecution = currentCase ? execution[currentCase.id] : null;
  const completedCount = selectedCases.filter((testCase) => execution[testCase.id]?.outcome).length;
  const allCompleted = selectedCases.length > 0 && completedCount === selectedCases.length;

  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const setOutcome = (outcome: Outcome) => {
    if (!currentCase) return;
    setExecution((current) => ({ ...current, [currentCase.id]: { ...current[currentCase.id], outcome } }));
  };
  const setNotes = (notes: string) => {
    if (!currentCase) return;
    setExecution((current) => ({ ...current, [currentCase.id]: { ...current[currentCase.id], notes } }));
  };
  const next = () => setCurrentIndex((index) => Math.min(index + 1, selectedCases.length - 1));
  const previous = () => setCurrentIndex((index) => Math.max(index - 1, 0));

  const saveRun = async () => {
    if (!projectId || !user || !allCompleted) return;
    setSaving(true);
    setError(null);
    const passed = selectedCases.filter((testCase) => execution[testCase.id].outcome === 'passed').length;
    const failed = selectedCases.filter((testCase) => execution[testCase.id].outcome === 'failed').length;
    const skipped = selectedCases.filter((testCase) => execution[testCase.id].outcome === 'skipped').length;
    const { data: run, error: runError } = await supabase.from('test_runs').insert({ project_id: projectId, tool_name: 'Krayo Hosted Runner', execution_source: 'hosted', executed_by: user.id, total_count: selectedCases.length, passed_count: passed, failed_count: failed, skipped_count: skipped, unmatched_count: 0 }).select('id').single();
    if (runError || !run) { setError('Could not save the test run.'); setSaving(false); return; }
    const results = selectedCases.map((testCase) => ({ test_run_id: run.id, project_id: projectId, executed_by: user.id, incoming_name: `${testCase.code} — ${testCase.title}`, test_case_id: testCase.id, test_case_code: testCase.code, outcome: execution[testCase.id].outcome, duration_seconds: null, failure_message: null, notes: execution[testCase.id].notes || null, external_report_url: null }));
    const { error: resultsError } = await supabase.from('test_run_results').insert(results);
    if (resultsError) { setError('The run was created, but its results could not be saved.'); setSaving(false); return; }
    for (const testCase of selectedCases) {
      const outcome = execution[testCase.id].outcome;
      const status = outcome === 'passed' ? 'Passed' : outcome === 'failed' ? 'Failed' : 'Blocked';
      await supabase.from('test_cases').update({ status }).eq('id', testCase.id).eq('project_id', projectId);
    }
    setSaved(true);
    setSaving(false);
  };

  if (loading) return <Loading label="Loading test cases…" />;
  if (saved) return <div className="max-w-xl"><div className="card p-8 text-center"><div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4"><Check className="text-green-600" /></div><h1 className="text-xl font-bold">Test run saved</h1><p className="text-sm text-text-muted mt-2">Your hosted execution results are now recorded and the test case statuses have been updated.</p><div className="flex justify-center gap-2 mt-6"><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/app/orgs/${projectId}/projects/${projectId}/automation`)}>View test runs</button><button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Run again</button></div></div></div>;

  return <div className="max-w-5xl">
    <div className="flex items-start justify-between gap-4 mb-6"><div><button className="text-xs text-text-muted hover:text-thread flex items-center gap-1 mb-2" onClick={() => navigate(-1)}><ArrowLeft size={13} /> Back</button><h1 className="text-xl font-bold flex items-center gap-2"><Play size={19} className="text-thread" /> Run tests in Krayo</h1><p className="text-sm text-text-muted mt-1">Execute selected test cases step-by-step and save the results as a project test run.</p></div>{started && <div className="text-right text-xs text-text-muted"><strong className="text-text">{completedCount}</strong> of {selectedCases.length} complete</div>}</div>
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {!started ? <section className="card overflow-hidden"><div className="p-5 border-b border-line flex items-center justify-between"><div><h2 className="font-semibold">Choose test cases</h2><p className="text-xs text-text-muted mt-1">{selected.length} selected of {cases.length}</p></div><button className="btn btn-ghost btn-sm" onClick={() => setSelected(selected.length === cases.length ? [] : cases.map((testCase) => testCase.id))}>{selected.length === cases.length ? 'Clear all' : 'Select all'}</button></div>{cases.length === 0 ? <div className="p-10"><EmptyState icon={ClipboardList} title="No test cases yet" message="Create test cases before starting a hosted run." /></div> : <div className="divide-y divide-line">{cases.map((testCase) => <label key={testCase.id} className="flex items-center gap-3 p-4 hover:bg-paper/60 cursor-pointer"><input type="checkbox" className="accent-thread" checked={selected.includes(testCase.id)} onChange={() => toggleSelected(testCase.id)} /><span className="badge bg-thread-bg text-thread font-mono">{testCase.code}</span><span className="text-sm font-medium">{testCase.title}</span><span className="ml-auto text-xs text-text-faint">{testCase.steps ? `${testCase.steps.split('\n').filter(Boolean).length} steps` : 'No steps'}</span></label>)}</div>}<div className="p-4 border-t border-line flex justify-end"><button className="btn btn-primary" disabled={!selected.length} onClick={() => setStarted(true)}><Play size={15} /> Start execution</button></div></section> : <section className="grid lg:grid-cols-[240px_1fr] gap-5"><aside className="card overflow-hidden h-fit"><div className="p-4 border-b border-line"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Run progress</p></div><div className="divide-y divide-line">{selectedCases.map((testCase, index) => { const outcome = execution[testCase.id].outcome; return <button key={testCase.id} className={`w-full text-left p-3 flex items-center gap-2 ${index === currentIndex ? 'bg-thread-bg' : 'hover:bg-paper/60'}`} onClick={() => setCurrentIndex(index)}><span className="shrink-0">{outcome === 'passed' ? <Check size={15} className="text-green-600" /> : outcome === 'failed' ? <X size={15} className="text-red-600" /> : outcome === 'skipped' ? <SkipForward size={15} className="text-orange-600" /> : <Circle size={15} className="text-text-faint" />}</span><span className="min-w-0"><span className="block text-xs font-mono text-text-muted">{testCase.code}</span><span className="block text-xs truncate">{testCase.title}</span></span></button>; })}</div></aside><div className="card p-6">{currentCase && currentExecution && <><div className="flex items-start justify-between gap-4 mb-6"><div><span className="badge bg-thread-bg text-thread font-mono">{currentCase.code}</span><h2 className="text-lg font-semibold mt-3">{currentCase.title}</h2></div><span className="text-xs text-text-muted">Test {currentIndex + 1} of {selectedCases.length}</span></div><div className="rounded-lg bg-paper p-4 mb-5"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Steps</p>{currentCase.steps ? <ol className="space-y-2 text-sm">{currentCase.steps.split('\n').filter(Boolean).map((step, index) => <li key={`${step}-${index}`} className="flex gap-3"><span className="text-xs text-text-faint font-mono">{index + 1}.</span><span>{step}</span></li>)}</ol> : <p className="text-sm text-text-muted">No steps were added. Use the expected result as your execution guide.</p>}{currentCase.expected_result && <div className="border-t border-line mt-4 pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Expected result</p><p className="text-sm">{currentCase.expected_result}</p></div>}</div><div className="grid sm:grid-cols-3 gap-2 mb-5">{(['passed', 'failed', 'skipped'] as Outcome[]).map((outcome) => <button key={outcome} className={`btn justify-center ${currentExecution.outcome === outcome ? outcome === 'passed' ? 'bg-green-100 text-green-700 border-green-200' : outcome === 'failed' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200' : 'btn-ghost'}`} onClick={() => setOutcome(outcome)}>{outcome === 'passed' ? <Check size={15} /> : outcome === 'failed' ? <X size={15} /> : <SkipForward size={15} />}{statusLabels[outcome]}</button>)}</div><label className="label">Tester notes <span className="font-normal text-text-faint">(optional)</span></label><textarea className="input min-h-24" value={currentExecution.notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record observations, evidence, or follow-up details…" /><div className="flex items-center justify-between mt-6"><button className="btn btn-ghost btn-sm" onClick={previous} disabled={currentIndex === 0}><ChevronLeft size={15} /> Previous</button><div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={next} disabled={currentIndex === selectedCases.length - 1}>Next <ChevronRight size={15} /></button>{allCompleted && <button className="btn btn-primary btn-sm" onClick={saveRun} disabled={saving}>{saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save test run</>}</button>}</div></div></>}</div></section>}
  </div>;
}
