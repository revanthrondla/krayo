import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Network } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, EmptyState } from '../../components/States';
import type { Requirement, TestCase, Defect } from '../../lib/types';

export function RtmPage() {
  const { projectId } = useParams();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const [reqRes, tcRes, defRes] = await Promise.all([
          supabase.from('requirements').select('*').eq('project_id', projectId).order('created_at'),
          supabase.from('test_cases').select('*').eq('project_id', projectId).order('created_at'),
          supabase.from('defects').select('*').eq('project_id', projectId).order('created_at'),
        ]);
        setRequirements((reqRes.data ?? []) as Requirement[]);
        setTestCases((tcRes.data ?? []) as TestCase[]);
        setDefects((defRes.data ?? []) as Defect[]);
      } catch (err) { console.error('Failed to load RTM data:', err); }
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <Loading label="Loading traceability matrix…" />;

  const rows = requirements.map((req) => ({
    requirement: req,
    testCases: testCases.filter((tc) => tc.requirement_id === req.id),
    defects: defects.filter((d) => d.test_case_id && testCases.some((tc) => tc.id === d.test_case_id && tc.requirement_id === req.id)),
  }));
  const untracedTcs = testCases.filter((tc) => !tc.requirement_id);
  const untracedDefs = defects.filter((d) => !d.test_case_id);

  if (requirements.length === 0 && testCases.length === 0 && defects.length === 0) {
    return <EmptyState icon={Network} title="No data for traceability" message="Add requirements, test cases, and defects to see the Requirements Traceability Matrix." />;
  }

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold flex items-center gap-2"><Network size={20} className="text-thread" /> Requirements Traceability Matrix</h1><p className="text-sm text-text-muted mt-0.5">Links requirements to test cases and defects</p></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line bg-paper/50"><th className="text-left px-4 py-2.5 font-medium text-text-muted">Requirement</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Test Cases</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Defects</th><th className="text-left px-4 py-2.5 font-medium text-text-muted">Coverage</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirement.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="badge bg-thread-bg text-thread font-mono">{row.requirement.code}</span><span className="font-medium text-text">{row.requirement.title}</span></div></td>
                <td className="px-4 py-3">{row.testCases.length === 0 ? <span className="text-text-faint text-xs">No test cases</span> : <div className="flex flex-wrap gap-1">{row.testCases.map((tc) => <span key={tc.id} className="badge bg-blue-50 text-blue-600 font-mono">{tc.code}</span>)}</div>}</td>
                <td className="px-4 py-3">{row.defects.length === 0 ? <span className="text-text-faint text-xs">No defects</span> : <div className="flex flex-wrap gap-1">{row.defects.map((d) => <span key={d.id} className="badge bg-red-50 text-red-600 font-mono">{d.code}</span>)}</div>}</td>
                <td className="px-4 py-3">{row.testCases.length > 0 ? <span className="badge bg-green-50 text-green-600">Covered</span> : <span className="badge bg-orange-50 text-orange-600">Uncovered</span>}</td>
              </tr>
            ))}
            {untracedTcs.length > 0 && (<tr className="border-b border-line"><td className="px-4 py-3 text-text-muted italic">Untraced test cases</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{untracedTcs.map((tc) => <span key={tc.id} className="badge bg-gray-100 text-gray-600 font-mono">{tc.code}</span>)}</div></td><td className="px-4 py-3 text-text-faint">—</td><td className="px-4 py-3"><span className="badge bg-orange-50 text-orange-600">No requirement</span></td></tr>)}
            {untracedDefs.length > 0 && (<tr><td className="px-4 py-3 text-text-muted italic">Untraced defects</td><td className="px-4 py-3 text-text-faint">—</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{untracedDefs.map((d) => <span key={d.id} className="badge bg-gray-100 text-gray-600 font-mono">{d.code}</span>)}</div></td><td className="px-4 py-3"><span className="badge bg-orange-50 text-orange-600">No test case</span></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
