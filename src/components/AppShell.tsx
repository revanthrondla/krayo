import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { NavLink, useNavigate, useParams, Outlet } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Settings, LogOut, Building2, FolderKanban, Menu, X, Plus, ChevronDown,
  Shield, Lock, Bell, Home, UserCog, CreditCard,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getProfile } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org-context';
import { KrayoLogo } from './Logo';
import { MODULES, MODULE_ICONS, type ModuleKey } from '../lib/types';
import { Modal } from './Modal';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type Notification,
} from '../lib/notifications';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { orgs, activeOrg, projects, activeProject, setActiveOrgId, setActiveProjectId, createOrg, createProject } = useOrg();
  const navigate = useNavigate();
  const { orgId, projectId } = useParams();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newOrgModal, setNewOrgModal] = useState(false);
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]); const [notifLoading, setNotifLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setNotifLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      getProfile().then((p) => setEmailVerified(p?.email_verified ?? false));
    }
    const interval = setInterval(() => { if (user) fetchNotifications(); }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await supabase.functions.invoke('send-verification-email', {});
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch { /* ignore */ }
    setResending(false);
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };
  const handleCreateOrg = async () => { if (!newOrgName.trim()) return; setCreating(true); try { await createOrg(newOrgName.trim()); setNewOrgName(''); setNewOrgModal(false); } catch (err) { console.error(err); } setCreating(false); };
  const handleCreateProject = async () => { if (!newProjectName.trim()) return; setCreating(true); try { await createProject(newProjectName.trim(), newProjectDesc.trim() || null); setNewProjectName(''); setNewProjectDesc(''); setNewProjectModal(false); } catch (err) { console.error(err); } setCreating(false); };

  const handleMarkRead = async (id: string) => { await markNotificationRead(id); await fetchNotifications(); };
  const handleMarkAllRead = async () => { await markAllNotificationsRead(); await fetchNotifications(); };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const sidebarModules = MODULES.filter((m) => m.key !== 'overview' && m.key !== 'executive' && m.key !== 'rtm');
  const overviewModule = MODULES.find((m) => m.key === 'overview')!;
  const execModule = MODULES.find((m) => m.key === 'executive')!;
  const rtmModule = MODULES.find((m) => m.key === 'rtm')!;

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-60 bg-ink text-white flex flex-col shrink-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-4 flex items-center justify-between">
          <button className="flex items-center gap-2 font-bold text-base" onClick={() => navigate('/app/home')}><KrayoLogo size={20} /> Krayo</button>
          <button className="lg:hidden text-white/60" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto mt-2">
          <SidebarLink to="/app/home" iconKey="home" label="Home" />
          {activeProject && orgId && projectId && (<>
            <div className="pt-2" />
            <SidebarLink to={`/app/orgs/${orgId}/projects/${projectId}/overview`} iconKey="overview" label={overviewModule.label} />
            <SidebarLink to={`/app/orgs/${orgId}/projects/${projectId}/executive`} iconKey="executive" label={execModule.label} />
            <div className="my-2 border-t border-white/10" />
            {sidebarModules.map((m) => <SidebarLink key={m.key} to={`/app/orgs/${orgId}/projects/${projectId}/${m.key}`} iconKey={m.key} label={m.label} />)}
            <div className="my-2 border-t border-white/10" />
            <SidebarLink to={`/app/orgs/${orgId}/projects/${projectId}/rtm`} iconKey="rtm" label={rtmModule.label} />
          </>)}
          <div className="my-2 border-t border-white/10" />
          {activeOrg && <SidebarLink to={`/app/orgs/${activeOrg.id}/settings`} iconKey="settings" label="Org Settings" />}
          {activeOrg && <SidebarLink to={`/app/orgs/${activeOrg.id}/security`} iconKey="security" label="Enterprise Security" />}
          {activeOrg && <SidebarLink to="/app/billing" iconKey="billing" label="Billing & Plans" />}
          {activeOrg && <SidebarLink to={`/app/orgs/${activeOrg.id}/resources`} iconKey="resources" label="Enterprise Resources" />}
          {activeProject && orgId && projectId && <SidebarLink to={`/app/orgs/${orgId}/projects/${projectId}/security`} iconKey="security" label="Project Security" />}
          <SidebarLink to="/app/admin" iconKey="admin" label="Platform Admin" />
        </nav>
        <div className="px-3 py-3 border-t border-white/10 relative">
          <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <div className="w-7 h-7 rounded-full bg-thread flex items-center justify-center text-xs font-bold">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
            <span className="text-xs text-white/80 truncate flex-1 text-left">{user?.email}</span>
            <ChevronDown size={14} className="text-white/40" />
          </button>
          {userMenuOpen && (
            <div className="absolute bottom-14 left-3 right-3 card p-1 shadow-lg animate-fade-in">
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-paper rounded-lg transition-colors" onClick={() => { setUserMenuOpen(false); navigate('/app/home'); }}><Home size={15} /> Home</button>
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-paper rounded-lg transition-colors" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button className="lg:hidden text-ink" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
              <div className="relative">
                <button className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-thread transition-colors" onClick={() => { setOrgMenuOpen(!orgMenuOpen); setProjectMenuOpen(false); }}>
                  <Building2 size={15} className="text-text-muted" />{activeOrg?.name ?? 'Select org'}<ChevronDown size={14} className="text-text-faint" />
                </button>
                {orgMenuOpen && (<DropdownMenu onClose={() => setOrgMenuOpen(false)}>
                  {orgs.map((o) => (<button key={o.id} className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors ${o.id === activeOrg?.id ? 'bg-thread-bg text-thread font-semibold' : 'text-text hover:bg-paper'}`} onClick={() => { setActiveOrgId(o.id); setOrgMenuOpen(false); }}><Building2 size={14} />{o.name}</button>))}
                  <div className="border-t border-line my-1" />
                  <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-thread hover:bg-paper rounded-lg transition-colors" onClick={() => { setOrgMenuOpen(false); setNewOrgModal(true); }}><Plus size={14} /> New organization</button>
                </DropdownMenu>)}
              </div>
              {activeOrg && (
                <div className="relative">
                  <button className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-thread transition-colors" onClick={() => { setProjectMenuOpen(!projectMenuOpen); setOrgMenuOpen(false); }}>
                    <FolderKanban size={15} className="text-text-muted" /><ChevronDown size={14} className="text-text-faint" />
                  </button>
                  {projectMenuOpen && (<DropdownMenu onClose={() => setProjectMenuOpen(false)}>
                    {projects.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">No projects yet</p>}
                    {projects.map((p) => (<button key={p.id} className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors ${p.id === activeProject?.id ? 'bg-thread-bg text-thread font-semibold' : 'text-text hover:bg-paper'}`} onClick={() => { setActiveProjectId(p.id); setProjectMenuOpen(false); }}><FolderKanban size={14} />{p.name}</button>))}
                    <div className="border-t border-line my-1" />
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-thread hover:bg-paper rounded-lg transition-colors" onClick={() => { setProjectMenuOpen(false); setNewProjectModal(true); }}><Plus size={14} /> New project</button>
                  </DropdownMenu>)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button className="relative z-20 p-2 rounded-lg hover:bg-card transition-colors text-text-muted" onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}>
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {notifOpen && (<>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-80 card shadow-xl animate-fade-in max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                      <span className="text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && <button className="text-xs text-thread hover:underline" onClick={handleMarkAllRead}>Mark all read</button>}
                    </div>
                    {notifLoading ? <div className="p-4 text-sm text-text-muted text-center">Loading…</div> : notifications.length === 0 ? <div className="p-6 text-sm text-text-muted text-center">No notifications yet</div> : (
                      <div className="divide-y divide-line">
                        {notifications.map((n) => (
                          <button key={n.id} className={`flex items-start gap-2 w-full px-4 py-3 text-left hover:bg-paper transition-colors ${!n.read ? 'bg-thread-bg/30' : ''}`} onClick={() => { handleMarkRead(n.id); }}>
                            {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-thread shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-text">{n.message}</p>
                              <p className="text-xs text-text-faint mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>)}
              </div>
            </div>
          </div>
        </header>
        {user && emailVerified === false && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-sm">
            <span className="text-amber-800">Please verify your email address.</span>
            {resent ? (
              <span className="text-green-600 font-medium">Verification email sent!</span>
            ) : (
              <button onClick={handleResendVerification} disabled={resending} className="text-thread font-medium hover:underline disabled:opacity-50">
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}
        <main className="flex-1 min-w-0 p-4 lg:p-6"><Outlet /></main>
      </div>
      <Modal open={newOrgModal} onClose={() => setNewOrgModal(false)} title="New organization" maxWidth="max-w-sm">
        <div className="mb-3"><label className="label">Organization name</label><input className="input" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus /></div>
        <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setNewOrgModal(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()}>{creating ? 'Creating…' : 'Create'}</button></div>
      </Modal>
      <Modal open={newProjectModal} onClose={() => setNewProjectModal(false)} title="New project" maxWidth="max-w-sm">
        <div className="mb-3"><label className="label">Project name</label><input className="input" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. ERP Rollout" autoFocus /></div>
        <div className="mb-3"><label className="label">Description (optional)</label><textarea className="input" rows={3} value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setNewProjectModal(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleCreateProject} disabled={creating || !newProjectName.trim()}>{creating ? 'Creating…' : 'Create'}</button></div>
      </Modal>
    </div>
  );
}

function SidebarLink({ to, iconKey, label }: { to: string; iconKey: ModuleKey | 'settings' | 'security' | 'admin' | 'home' | 'resources' | 'billing'; label: string }) {
  const iconMap: Record<string, LucideIcon> = { settings: Settings, security: Lock, admin: Shield, home: Home, resources: UserCog, billing: CreditCard };
  const Icon: LucideIcon = iconMap[iconKey] ?? MODULE_ICONS[MODULES.find((m) => m.key === iconKey)?.icon ?? 'LayoutDashboard'] ?? Settings;
  return <NavLink to={to} className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-thread text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon size={16} />{label}</NavLink>;
}

function DropdownMenu({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <><div className="fixed inset-0 z-10" onClick={onClose} /><div className="absolute top-full left-0 mt-1 z-20 card p-1 min-w-[200px] shadow-lg animate-fade-in">{children}</div></>;
}
