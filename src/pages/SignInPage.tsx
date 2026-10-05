import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { KrayoLogo } from '../components/Logo';
import { friendlyMessage } from '../lib/errors';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { await signIn(email, password); navigate('/app'); } catch (err) { setError(friendlyMessage(err, 'Sign in failed')); }
    setLoading(false);
  };
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setResetLoading(true); setResetError(null);
    try {
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${origin}/reset-password` });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err) { setResetError(friendlyMessage(err, 'Could not send reset email')); }
    setResetLoading(false);
  };
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm mb-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={15} /> Back to home
        </button>
      </div>
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
        {resetMode ? (
          <>
            <h1 className="text-xl font-semibold mb-1">Reset your password</h1>
            <p className="text-sm text-text-muted mb-5">Enter your email and we'll send you a link to set a new password.</p>
            {resetSent ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><Mail size={22} className="text-green-600" /></div>
                <p className="text-sm text-text mb-4">Check your inbox at <span className="font-semibold">{resetEmail}</span> for a password reset link.</p>
                <button className="btn btn-primary w-full" onClick={() => { setResetMode(false); setResetSent(false); setResetEmail(''); }}>Back to sign in</button>
              </div>
            ) : (
              <>
                <form onSubmit={handleReset}>
                  <div className="mb-3"><label className="label">Email</label><input type="email" className="input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoFocus /></div>
                  {resetError && <p className="text-xs text-red mb-3">{resetError}</p>}
                  <button type="submit" className="btn btn-primary w-full" disabled={resetLoading || !resetEmail.trim()}>{resetLoading ? 'Sending…' : 'Send reset link'}</button>
                </form>
                <button className="text-xs text-text-muted text-center mt-4 w-full hover:text-text transition-colors" onClick={() => { setResetMode(false); setResetError(null); }}>Back to sign in</button>
              </>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
            <p className="text-sm text-text-muted mb-5">Sign in to your account</p>
            <form onSubmit={handleSubmit}>
              <div className="mb-3"><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
              <div className="mb-3">
                <div className="flex items-center justify-between"><label className="label">Password</label><button type="button" className="text-xs text-thread hover:underline transition-colors flex items-center gap-0.5" onClick={() => { setResetMode(true); setResetEmail(email); }}>Forgot password? <ArrowRight size={11} /></button></div>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-xs text-red mb-3">{error}</p>}
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
            </form>
            <p className="text-xs text-text-muted text-center mt-4">Don't have an account? <Link to="/signup" className="text-thread hover:underline">Sign up</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
