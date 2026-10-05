import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckSquare, Keyboard, ListChecks, Loader2, MousePointerClick, Play, Plus, Save, Send, Square, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Loading, EmptyState } from '../../components/States';
import { Modal } from '../../components/Modal';
import type { TestCase } from '../../lib/types';

type StepAction = 'click' | 'input' | 'select' | 'check' | 'submit' | 'navigate';
type RecordedStep = { id: string; action: StepAction; description: string; selector?: string; value?: string; url?: string };

const ACTION_ICONS: Record<StepAction, typeof MousePointerClick> = {
  click: MousePointerClick,
  input: Keyboard,
  select: ListChecks,
  check: CheckSquare,
  submit: Send,
  navigate: ArrowRight,
};

const CYCLES = ['CRP', 'SIT', 'UAT'];

export function TestRecorderPage() {
  const { projectId, orgId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [url, setUrl] = useState('');
  const [recording, setRecording] = useState(false);
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveModal, setSaveModal] = useState(false);

  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [newCase, setNewCase] = useState({ code: '', title: '', cycle: 'SIT', expected_result: '' });
  const [existingCases, setExistingCases] = useState<TestCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const recordingRef = useRef(false);
  const loadPageRef = useRef<(pageUrl: string) => Promise<void>>(async () => {});

  useEffect(() => { recordingRef.current = recording; }, [recording]);

  const loadPage = async (pageUrl: string) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('record-proxy', { body: { url: pageUrl } });
    if (invokeError || !data?.html) {
      setError(invokeError?.message || 'Could not load the page. Check the URL and try again.');
      setLoading(false);
      return;
    }
    setIframeHtml(data.html as string);
    setCurrentUrl(data.url as string);
    setIframeKey((k) => k + 1);
    setLoading(false);
  };

  loadPageRef.current = loadPage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== 'krayo-recorder') return;
      if (event.data.type === 'step' && recordingRef.current) {
        setSteps((prev) => [...prev, { ...event.data.step, id: crypto.randomUUID() }]);
      } else if (event.data.type === 'navigate') {
        loadPageRef.current(event.data.url as string);
      } else if (event.data.type === 'loaded') {
        if (recordingRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ source: 'krayo-control', type: 'start' }, '*');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const startRecording = async () => {
    let pageUrl = url.trim();
    if (!pageUrl) return;
    if (!/^https?:\/\//i.test(pageUrl)) pageUrl = 'https://' + pageUrl;
    setUrl(pageUrl);
    setSteps([]);
    setRecording(true);
    await loadPage(pageUrl);
  };

  const stopRecording = () => {
    setRecording(false);
    iframeRef.current?.contentWindow?.postMessage({ source: 'krayo-control', type: 'stop' }, '*');
  };

  const deleteStep = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));
  const clearSteps = () => setSteps([]);

  const openSaveModal = async () => {
    if (!projectId) return;
    setSaveMode('new');
    setNewCase({ code: '', title: '', cycle: 'SIT', expected_result: '' });
    setSelectedCaseId('');
    const { data } = await supabase.from('test_cases').select('id, code, title').eq('project_id', projectId).order('code');
    setExistingCases((data ?? []) as TestCase[]);
    setSaveModal(true);
  };

  const handleSave = async () => {
    if (!projectId) return;
    const stepsText = steps.map((s) => s.description).join('\n');
    setSaving(true);
    setError(null);
    if (saveMode === 'new') {
      if (!newCase.code.trim() || !newCase.title.trim()) { setSaving(false); return; }
      const { error: insertError } = await supabase.from('test_cases').insert({
        project_id: projectId,
        code: newCase.code,
        title: newCase.title,
        cycle: newCase.cycle,
        steps: stepsText,
        expected_result: newCase.expected_result || null,
        status: 'Not Run',
      });
      if (insertError) { setError('Could not save the test case.'); setSaving(false); return; }
    } else if (selectedCaseId) {
      const { error: updateError } = await supabase.from('test_cases').update({ steps: stepsText }).eq('id', selectedCaseId).eq('project_id', projectId);
      if (updateError) { setError('Could not update the test case.'); setSaving(false); return; }
    }
    setSaving(false);
    setSaveModal(false);
    navigate(`/app/orgs/${orgId}/projects/${projectId}/testcases`);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="text-text-muted hover:text-text transition-colors" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div className="flex-1 flex items-center gap-2">
          <input className="input flex-1" type="text" placeholder="Enter a URL to record (e.g. https://example.com)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !recording) startRecording(); }} disabled={recording} />
          {recording ? (
            <button className="btn btn-ghost btn-sm whitespace-nowrap" onClick={stopRecording}><Square size={14} className="text-red-500" /> Stop</button>
          ) : (
            <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={startRecording} disabled={loading || !url.trim()}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {loading ? 'Loading…' : 'Record'}</button>
          )}
        </div>
        <button className="btn btn-ghost btn-sm whitespace-nowrap" onClick={openSaveModal} disabled={steps.length === 0}><Save size={14} /> Save as test case</button>
      </div>

      {recording && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="flex items-center gap-1.5 text-red-600 font-medium"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording</span>
          {currentUrl && <span className="text-text-muted truncate max-w-md">{currentUrl}</span>}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="card overflow-hidden h-[calc(100vh-12rem)]">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loading label="Loading page…" /></div>
          ) : iframeHtml ? (
            <iframe key={iframeKey} ref={iframeRef} srcDoc={iframeHtml} title="Recorded page" className="w-full h-full border-0" sandbox="allow-scripts allow-forms allow-popups" />
          ) : (
            <div className="h-full flex items-center justify-center"><EmptyState icon={MousePointerClick} title="Ready to record" message="Enter a URL above and click Record to start capturing test steps as you interact with the page." /></div>
          )}
        </div>

        <div className="card overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <div><h2 className="font-semibold text-sm">Recorded steps</h2><p className="text-xs text-text-muted">{steps.length} step{steps.length !== 1 ? 's' : ''}</p></div>
            {steps.length > 0 && <button className="text-xs text-text-muted hover:text-red transition-colors" onClick={clearSteps}>Clear</button>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {steps.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-muted">No steps recorded yet. Interact with the page to capture actions.</div>
            ) : (
              <ol className="divide-y divide-line">
                {steps.map((step, index) => {
                  const Icon = ACTION_ICONS[step.action] || MousePointerClick;
                  return (
                    <li key={step.id} className="group p-3 flex items-start gap-2 hover:bg-paper/50 transition-colors">
                      <span className="text-xs text-text-faint font-mono mt-0.5">{index + 1}.</span>
                      <Icon size={15} className="text-text-muted mt-0.5 shrink-0" />
                      <span className="text-sm flex-1">{step.description}</span>
                      <button className="text-text-faint hover:text-red opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteStep(step.id)}><Trash2 size={13} /></button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      <Modal open={saveModal} onClose={() => setSaveModal(false)} title="Save as test case" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button className={`btn btn-sm flex-1 justify-center ${saveMode === 'new' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSaveMode('new')}><Plus size={14} /> New test case</button>
            <button className={`btn btn-sm flex-1 justify-center ${saveMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSaveMode('existing')}>Existing test case</button>
          </div>

          {saveMode === 'new' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Code</label><input className="input" value={newCase.code} onChange={(e) => setNewCase({ ...newCase, code: e.target.value })} placeholder="TC-001" /></div>
                <div><label className="label">Cycle</label><select className="input" value={newCase.cycle} onChange={(e) => setNewCase({ ...newCase, cycle: e.target.value })}>{CYCLES.map((c) => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div><label className="label">Title</label><input className="input" value={newCase.title} onChange={(e) => setNewCase({ ...newCase, title: e.target.value })} placeholder="Verify user can log in" /></div>
              <div><label className="label">Expected Result</label><textarea className="input" rows={2} value={newCase.expected_result} onChange={(e) => setNewCase({ ...newCase, expected_result: e.target.value })} /></div>
            </div>
          ) : (
            <div>
              <label className="label">Select test case</label>
              <select className="input" value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
                <option value="">— Choose a test case —</option>
                {existingCases.map((tc) => <option key={tc.id} value={tc.id}>{tc.code} — {tc.title}</option>)}
              </select>
              {existingCases.length === 0 && <p className="text-xs text-text-muted mt-2">No test cases found. Create a new one instead.</p>}
            </div>
          )}

          <div className="rounded-lg bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Steps preview ({steps.length})</p>
            <ol className="space-y-1 text-xs max-h-32 overflow-y-auto">
              {steps.map((step, index) => <li key={step.id} className="flex gap-2"><span className="text-text-faint font-mono">{index + 1}.</span><span>{step.description}</span></li>)}
            </ol>
          </div>

          {error && <p className="text-xs text-red">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setSaveModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || (saveMode === 'new' && (!newCase.code.trim() || !newCase.title.trim())) || (saveMode === 'existing' && !selectedCaseId)}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
