import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Org, Project } from './types';

const STORAGE_ORG = 'krayo.activeOrg';
const STORAGE_PROJECT = 'krayo.activeProject';

interface OrgContextValue {
  orgs: Org[]; activeOrg: Org | null; projects: Project[]; activeProject: Project | null; loading: boolean;
  setActiveOrgId: (id: string) => void; setActiveProjectId: (id: string) => void;
  createOrg: (name: string) => Promise<Org>;
  createProject: (name: string, description: string | null) => Promise<Project>;
  refreshOrgs: () => Promise<void>; refreshProjects: (orgId: string) => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at');
      if (error) throw error;
      setOrgs(data ?? []);
      if (data && data.length > 0) {
        const stored = localStorage.getItem(STORAGE_ORG);
        setActiveOrg(stored ? data.find((o) => o.id === stored) ?? data[0] : data[0]);
      } else setActiveOrg(null);
    } catch { setOrgs([]); setActiveOrg(null); }
  }, []);

  const refreshProjects = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase.from('projects').select('*').eq('org_id', orgId).order('created_at');
      if (error) throw error;
      setProjects(data ?? []);
      if (data && data.length > 0) {
        const stored = localStorage.getItem(STORAGE_PROJECT);
        setActiveProject(stored ? data.find((p) => p.id === stored) ?? data[0] : data[0]);
      } else setActiveProject(null);
    } catch { setProjects([]); setActiveProject(null); }
  }, []);

  useEffect(() => { (async () => { await refreshOrgs(); setLoading(false); })(); }, [refreshOrgs]);
  useEffect(() => {
    if (activeOrg) { localStorage.setItem(STORAGE_ORG, activeOrg.id); refreshProjects(activeOrg.id); }
    else { setProjects([]); setActiveProject(null); }
  }, [activeOrg, refreshProjects]);

  const setActiveOrgId = (id: string) => { const o = orgs.find((o) => o.id === id); if (o) setActiveOrg(o); };
  const setActiveProjectId = (id: string) => { const p = projects.find((p) => p.id === id); if (p) { setActiveProject(p); localStorage.setItem(STORAGE_PROJECT, id); } };
  const createOrg = async (name: string): Promise<Org> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('organizations').insert({ name, owner_id: user?.id }).select().single();
    if (error) throw error; await refreshOrgs(); return data as Org;
  };
  const createProject = async (name: string, description: string | null): Promise<Project> => {
    if (!activeOrg) throw new Error('No active organization');
    if (activeOrg.plan === 'free') {
      const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('org_id', activeOrg.id);
      if ((count ?? 0) >= 1) throw new Error('The Free plan is limited to 1 project. Upgrade to Team for unlimited projects.');
    }
    const { data, error } = await supabase.from('projects').insert({ name, description, org_id: activeOrg.id }).select().single();
    if (error) throw error; await refreshProjects(activeOrg.id); return data as Project;
  };

  return <OrgContext.Provider value={{ orgs, activeOrg, projects, activeProject, loading, setActiveOrgId, setActiveProjectId, createOrg, createProject, refreshOrgs, refreshProjects }}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
