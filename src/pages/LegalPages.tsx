import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KrayoLogo } from '../components/Logo';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-base"><KrayoLogo size={22} /> Krayo</Link>
          <Link to="/" className="btn btn-ghost btn-sm">Back to home</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: {lastUpdated}</p>
        <div className="prose prose-sm max-w-none text-text leading-relaxed space-y-4">
          {children}
        </div>
      </div>
      <footer className="border-t border-line">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><KrayoLogo size={18} /> Krayo</div>
          <div className="flex items-center gap-4 text-xs text-text-faint">
            <Link to="/terms" className="hover:text-text transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-text transition-colors">Privacy</Link>
            <Link to="/security" className="hover:text-text transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="October 1, 2026">
      <p>These Terms of Service govern your use of Krayo, a QA project management platform. By creating an account or using Krayo, you agree to these terms.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">1. Accounts</h2>
      <p>You are responsible for maintaining the security of your account and password. Krayo is not liable for any loss or damage from unauthorized access to your account.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">2. Acceptable Use</h2>
      <p>You agree not to use Krayo to upload malicious content, attempt to access other users' data, or disrupt the service. Violations may result in account termination.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">3. Your Data</h2>
      <p>You retain ownership of all data you create in Krayo. You may export your data at any time via CSV export. We do not sell your data to third parties.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">4. Plans and Billing</h2>
      <p>Krayo offers a Free plan and paid plans. Paid plans are billed monthly per seat. Team plans include a 14-day trial — no charge until the trial ends. You can cancel at any time.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">5. Service Availability</h2>
      <p>We strive for high uptime but do not guarantee uninterrupted service. We are not liable for downtime, data loss, or any damages arising from service interruptions.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">6. Termination</h2>
      <p>You may delete your account at any time. We reserve the right to suspend accounts that violate these terms.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">7. Changes</h2>
      <p>We may update these terms periodically. Continued use after changes constitutes acceptance of the updated terms.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">8. Contact</h2>
      <p>Questions about these terms? Contact us at <a href="mailto:hello@krayo.io" className="text-thread hover:underline">hello@krayo.io</a>.</p>
    </LegalPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 1, 2026">
      <p>This Privacy Policy explains how Krayo collects, uses, and protects your information.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">1. Information We Collect</h2>
      <p>We collect your email address when you sign up. Within projects, you may create requirements, test cases, defects, and other QA artifacts — this is your project data.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">2. How We Use Your Information</h2>
      <p>We use your email to authenticate you, send verification emails, and send notifications about assignments and mentions. We do not sell or rent your data.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">3. Data Storage</h2>
      <p>Your data is stored in a secure PostgreSQL database with row-level security. Each organization's data is isolated — users in one organization cannot access another organization's data.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">4. Data Retention</h2>
      <p>Your data is retained as long as your account is active. You may export and delete your data at any time.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">5. Third-Party Services</h2>
      <p>We use Supabase for authentication and database hosting, Stripe for payment processing, and Resend for transactional email. Each has their own privacy policy.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">6. Security</h2>
      <p>All data is transmitted over HTTPS. Passwords are hashed. Enterprise plans add IP allowlists, SSO enforcement, and enhanced data isolation.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">7. Your Rights</h2>
      <p>You may request export or deletion of your data at any time. Contact us at <a href="mailto:hello@krayo.io" className="text-thread hover:underline">hello@krayo.io</a> for any privacy requests.</p>
    </LegalPage>
  );
}

export function SecurityPage() {
  return (
    <LegalPage title="Security" lastUpdated="October 1, 2026">
      <p>Krayo takes security seriously. This page outlines our security practices and the controls available to Enterprise customers.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Data Isolation</h2>
      <p>Every project is protected by row-level security at the database level. Users can only access data within organizations and projects they belong to. Enterprise plans add enforced data isolation between projects.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Authentication</h2>
      <p>Passwords are hashed using industry-standard algorithms. Email verification is required. Enterprise plans can enforce SSO and two-factor authentication.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Encryption</h2>
      <p>All data in transit is encrypted via HTTPS/TLS. Data at rest is encrypted by our infrastructure provider.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Enterprise Security Controls</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>IP allowlists to restrict access to trusted networks</li>
        <li>SSO enforcement for organization-wide authentication</li>
        <li>Project-level membership controls</li>
        <li>Restricted project visibility to prevent cross-project data access</li>
        <li>Configurable maximum project members per project</li>
      </ul>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Responsible Disclosure</h2>
      <p>Found a security vulnerability? Please report it responsibly to <a href="mailto:security@krayo.io" className="text-thread hover:underline">security@krayo.io</a>. We will acknowledge receipt within 48 hours and work with you on remediation.</p>
      <h2 className="text-xl font-semibold text-ink mt-6 mb-2">Infrastructure</h2>
      <p>Krayo is built on Supabase (PostgreSQL, Auth, Edge Functions) and Stripe (payments). Our infrastructure providers are SOC 2 Type II certified.</p>
    </LegalPage>
  );
}
