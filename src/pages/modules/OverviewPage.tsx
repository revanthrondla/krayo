import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClipboardList, FlaskConical, Bug, CheckSquare, Gavel, ShieldAlert, BookOpen, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading } from '../../components/States';
import { useOrg } from '../../lib/org-context';
import type { LucideIcon } from 'lucide-react';

export function OverviewPage() {
  const { orgId, projectId } = useParams();
  const navigate = useNavigate();
  const { activeProject } = useOrg();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const tables = ['requirements', 'test_cases', 'defects', 'action_items', 'decisions', 'raid_entries', 'job_aids'];
        const results = await Promise.all(tables.map((t) => supabase.from(t).select('*', { count: 'exact', head: true }).eq('project_id', projectId)));
        const c: Record<string, number> = {};
        tables.forEach((t, i) => { c[t] = results[i].count ?? 0; });
        setCounts(c);
      } catch (err) { console.error('Failed to load counts:', err); }
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <Loading label="Loading overview…" />;

  const cards: { label: string; icon: LucideIcon; count: number; key: string }[] = [
    { label: 'Requirements', icon: ClipboardList, count: counts['requirements'] ?? 0, key: 'requirements' },
    { label: 'Test Cases', icon: FlaskConical, count: counts['test_cases'] ?? 0, key: 'testcases' },
    { label: 'Defects', icon: Bug, count: counts['defects'] ?? 0, key: 'defects' },
    { label: 'Action Items', icon: CheckSquare, count: counts['action_items'] ?? 0, key: 'actionitems' },
    { label: 'Decisions', icon: Gavel, count: counts['decisions'] ?? 0, key: 'decisions' },
    { label: 'RAID Entries', icon: ShieldAlert, count: counts['raid_entries'] ?? 0, key: 'raid' },
    { label: 'Job Aids', icon: BookOpen, count: counts['job_aids'] ?? 0, key: 'jobaids' },
  ];

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">{activeProject?.name ?? 'Project'} Overview</h1>{activeProject?.description && <p className="text-sm text-text-muted mt-1">{activeProject.description}</p>}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <button key={card.key} onClick={() => navigate(`/app/orgs/${orgId}/projects/${projectId}/${card.key}`)} className="card p-4 text-left hover:border-thread hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2"><div className="w-10 h-10 rounded-xl bg-thread-bg flex items-center justify-center"><card.icon size={18} className="text-thread" /></div><ArrowRight size={16} className="text-text-faint group-hover:text-thread transition-colors" /></div>
            <p className="text-2xl font-bold text-text">{card.count}</p><p className="text-xs text-text-muted">{card.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
