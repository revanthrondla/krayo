import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, type FormEvent } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { OrgProvider, useOrg } from './lib/org-context';
import { LandingPage } from './pages/LandingPage';
import { DeveloperPage } from './pages/DeveloperPage';
import { BlogPage } from './pages/BlogPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TermsPage, PrivacyPage, SecurityPage } from './pages/LegalPages';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/modules/OverviewPage';
import { ExecutiveDashboardPage } from './pages/modules/ExecutiveDashboardPage';
import { RequirementsPage } from './pages/modules/RequirementsPage';
import { TestCasesPage } from './pages/modules/TestCasesPage';
import { TestRunsPage } from './pages/modules/TestRunsPage';
import { TestExecutionPage } from './pages/modules/TestExecutionPage';
import { TestRecorderPage } from './pages/modules/TestRecorderPage';
import { DefectsPage } from './pages/modules/DefectsPage';
import { RtmPage } from './pages/modules/RtmPage';
import { ActionItemsPage } from './pages/modules/ActionItemsPage';
import { DecisionsPage } from './pages/modules/DecisionsPage';
import { RaidPage } from './pages/modules/RaidPage';
import { JobAidsPage } from './pages/modules/JobAidsPage';
import { ResourceAllocationPage } from './pages/modules/ResourceAllocationPage';
import { ProjectSecurityPage } from './pages/modules/ProjectSecurityPage';
import { EnterpriseResourcesPage } from './pages/EnterpriseResourcesPage';
import { OrgSettingsPage } from './pages/OrgSettingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { EnterpriseSecurityPage } from './pages/EnterpriseSecurityPage';
import { UserHomePage } from './pages/UserHomePage';
import { BillingPage } from './pages/BillingPage';
import { Loading } from './components/States';
import { friendlyMessage } from './lib/errors';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center"><Loading label="Loading Krayo…" /></div>;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function OrgRedirect() {
  const { activeOrg, activeProject, loading } = useOrg();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!activeOrg) { navigate('/app/setup', { replace: true }); return; }
    navigate('/app/home', { replace: true });
  }, [activeOrg, activeProject, loading, orgId, navigate]);
  return <div className="min-h-screen bg-paper flex items-center justify-center"><Loading label="Loading…" /></div>;
}

function OrgSetup() {
  const { createOrg } = useOrg();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try { await createOrg(name.trim()); navigate('/app', { replace: true }); } catch (err) { setError(friendlyMessage(err, 'Failed to create organization')); }
    setLoading(false);
  };
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7">
        <h1 className="text-xl font-semibold mb-1">Create your organization</h1>
        <p className="text-sm text-text-muted mb-5">You're signed in but don't have an organization yet. Create one to get started.</p>
        <form onSubmit={handleCreate}>
          <div className="mb-3"><label className="label">Organization name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" required autoFocus /></div>
          {error && <p className="text-xs text-red mb-3">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading || !name.trim()}>{loading ? 'Creating…' : 'Create organization'}</button>
        </form>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/developer" element={<DeveloperPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/app" element={<ProtectedRoute><OrgProvider><OrgRedirect /></OrgProvider></ProtectedRoute>} />
      <Route path="/app/setup" element={<ProtectedRoute><OrgProvider><OrgSetup /></OrgProvider></ProtectedRoute>} />
      <Route element={<ProtectedRoute><OrgProvider><AppShell /></OrgProvider></ProtectedRoute>}>
        <Route path="/app/home" element={<UserHomePage />} />
        <Route path="/app/admin" element={<AdminDashboardPage />} />
        <Route path="/app/orgs/:orgId/settings" element={<OrgSettingsPage />} />
        <Route path="/app/orgs/:orgId/security" element={<EnterpriseSecurityPage />} />
        <Route path="/app/orgs/:orgId/resources" element={<EnterpriseResourcesPage />} />
        <Route path="/app/billing" element={<BillingPage />} />
        <Route path="/app/orgs/:orgId/projects/:projectId">
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="executive" element={<ExecutiveDashboardPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="testcases" element={<TestCasesPage />} />
          <Route path="automation" element={<TestRunsPage />} />
          <Route path="automation/execute" element={<TestExecutionPage />} />
          <Route path="automation/record" element={<TestRecorderPage />} />
          <Route path="defects" element={<DefectsPage />} />
          <Route path="rtm" element={<RtmPage />} />
          <Route path="actionitems" element={<ActionItemsPage />} />
          <Route path="decisions" element={<DecisionsPage />} />
          <Route path="raid" element={<RaidPage />} />
          <Route path="jobaids" element={<JobAidsPage />} />
          <Route path="resources" element={<ResourceAllocationPage />} />
          <Route path="security" element={<ProjectSecurityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}
