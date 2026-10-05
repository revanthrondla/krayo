import { useState } from 'react';
import { Sparkles, Loader2, Check, X, Upload, Download, Plus, Lock, Settings2 } from 'lucide-react';
import { Modal } from './Modal';
import { UpgradeModal } from './UpgradeModal';
import { CustomFieldsManager } from './CustomFieldsManager';
import { generateItems, type AiGeneratedItem } from '../lib/ai';
import { exportToCsv, parseCsv } from '../lib/csv';
import { friendlyMessage } from '../lib/errors';

interface ModuleToolbarProps {
  moduleName: string; moduleKey: string; items: unknown[];
  exportHeaders: string[]; csvHeaders: string[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  onAdd: () => void; addLabel?: string;
  orgPlan?: string;
  projectId?: string;
  onCustomFieldsChanged?: () => void;
}

export function ModuleToolbar({ moduleName, moduleKey, items, exportHeaders, csvHeaders, onImport, onAdd, addLabel = 'Add item', orgPlan, projectId, onCustomFieldsChanged }: ModuleToolbarProps) {
  const [aiModal, setAiModal] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [customFieldsModal, setCustomFieldsModal] = useState(false);
  const [customFieldsUpgrade, setCustomFieldsUpgrade] = useState(false);

  const canUseAi = orgPlan !== 'free';
  const canUseCustomFields = orgPlan !== 'free';

  const handleExport = () => { exportToCsv(`${moduleKey}.csv`, items as Record<string, unknown>[], exportHeaders); };

  const handleCustomFieldsClick = () => {
    if (canUseCustomFields) setCustomFieldsModal(true);
    else setCustomFieldsUpgrade(true);
  };

  const handleImport = async () => {
    setImporting(true); setImportError(null);
    try {
      const rows = parseCsv(importText);
      if (rows.length === 0) { setImportError('No valid rows found. Make sure you have a header row and at least one data row.'); setImporting(false); return; }
      await onImport(rows);
      setImportModal(false); setImportText('');
    } catch (err) { setImportError(friendlyMessage(err, 'Import failed')); }
    setImporting(false);
  };

  const handleAiClick = () => {
    if (canUseAi) setAiModal(true);
    else setUpgradeModal(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={15} /> {addLabel}</button>
        <button className="btn btn-ghost btn-sm relative" onClick={handleAiClick}>
          <Sparkles size={15} className={canUseAi ? 'text-thread' : 'text-text-faint'} />
          AI Generate
          {!canUseAi && <Lock size={11} className="text-text-faint" />}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setImportModal(true)}><Upload size={15} /> Import</button>
        <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={items.length === 0}><Download size={15} /> Export</button>
        <button className="btn btn-ghost btn-sm" onClick={handleCustomFieldsClick}>
          <Settings2 size={15} className={canUseCustomFields ? 'text-thread' : 'text-text-faint'} />
          Custom Fields
          {!canUseCustomFields && <Lock size={11} className="text-text-faint" />}
        </button>
      </div>
      {canUseAi && <AiGenerateModal open={aiModal} onClose={() => setAiModal(false)} moduleName={moduleName} moduleKey={moduleKey} onImport={onImport} />}
      {!canUseAi && <UpgradeModal open={upgradeModal} onClose={() => setUpgradeModal(false)} triggerFeature="AI Generation" />}
      {canUseCustomFields && <CustomFieldsManager open={customFieldsModal} onClose={() => { setCustomFieldsModal(false); onCustomFieldsChanged?.(); }} projectId={projectId} moduleKey={moduleKey} moduleName={moduleName} />}
      {!canUseCustomFields && <UpgradeModal open={customFieldsUpgrade} onClose={() => setCustomFieldsUpgrade(false)} triggerFeature="Custom Fields" />}
      <Modal open={importModal} onClose={() => setImportModal(false)} title={`Import ${moduleName}`} maxWidth="max-w-xl">
        <div className="mb-3">
          <label className="label">CSV Data</label>
          <p className="text-xs text-text-muted mb-2">Paste CSV data with headers: <code className="text-thread">{csvHeaders.join(', ')}</code></p>
          <textarea className="input font-mono text-xs" rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={`${csvHeaders.join(',')}\nvalue1,value2,...`} />
        </div>
        {importError && <p className="text-xs text-red mb-3">{importError}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setImportModal(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importing || !importText.trim()}>{importing ? 'Importing…' : 'Import'}</button>
        </div>
      </Modal>
    </>
  );
}

function AiGenerateModal({ open, onClose, moduleName, moduleKey, onImport }: { open: boolean; onClose: () => void; moduleName: string; moduleKey: string; onImport: (rows: Record<string, string>[]) => Promise<void>; }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AiGeneratedItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true); setError(null); setGenerated(null);
    try {
      const items = await generateItems(moduleKey, description);
      setGenerated(items); setSelected(new Set(items.map((_, i) => i)));
    } catch (err) { setError(friendlyMessage(err, 'AI generation failed')); }
    setLoading(false);
  };

  const toggleItem = (idx: number) => { setSelected((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; }); };

  const handleAddSelected = async () => {
    if (!generated) return;
    setAdding(true);
    try {
      const rows = generated.filter((_, idx) => selected.has(idx)).map((item) => {
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(item)) row[k] = String(v);
        return row;
      });
      await onImport(rows);
      onClose(); setDescription(''); setGenerated(null); setSelected(new Set());
    } catch (err) { setError(friendlyMessage(err, 'Failed to add items')); }
    setAdding(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={`AI Generate — ${moduleName}`} maxWidth="max-w-2xl">
      {!generated && (
        <div>
          <label className="label">Describe what you need</label>
          <p className="text-xs text-text-muted mb-2">Describe your project or feature, and AI will generate {moduleName.toLowerCase()} for you to review.</p>
          <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`e.g. "We're building an e-commerce platform with user authentication, product catalog, shopping cart, and checkout flow."`} autoFocus />
          {error && <p className="text-xs text-red mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading || !description.trim()}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate</>}
            </button>
          </div>
        </div>
      )}
      {generated && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-muted">{selected.size} of {generated.length} selected</p>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set(generated.map((_, i) => i)))}>Select all</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Deselect all</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {generated.map((item, idx) => (
              <div key={idx} className={`card p-3 cursor-pointer transition-all ${selected.has(idx) ? 'border-thread ring-1 ring-thread/30' : 'opacity-60'}`} onClick={() => toggleItem(idx)}>
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected.has(idx) ? 'bg-thread border-thread' : 'border-line'}`}>
                    {selected.has(idx) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-thread-bg text-thread font-mono">{item.code}</span>
                      <span className="text-sm font-semibold text-text">{item.title}</span>
                    </div>
                    <p className="text-xs text-text-muted">{item.description}</p>
                    {Object.entries(item).filter(([k]) => !['code', 'title', 'description'].includes(k)).map(([k, v]) => (
                      <span key={k} className="badge bg-paper text-text-muted mr-1 mt-1">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-ghost btn-sm" onClick={() => { setGenerated(null); setSelected(new Set()); }}><X size={15} /> Start over</button>
            <button className="btn btn-primary btn-sm" onClick={handleAddSelected} disabled={adding || selected.size === 0}>
              {adding ? <><Loader2 size={15} className="animate-spin" /> Adding…</> : <><Check size={15} /> Add {selected.size} item{selected.size !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
