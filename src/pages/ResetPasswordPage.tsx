import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { KrayoLogo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { friendlyMessage } from '../lib/errors';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'ready' | 'success' | 'error' | 'email-verified' | 'email-error'>('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'reset' | 'verify'>('reset');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 300));
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError || !data.session) {
          setStatus('error');
          setError('This link is invalid or has expired. Please request a new one.');
          return;
        }

        const emailConfirmedAt = data.session.user.email_confirmed_at;
        if (!emailConfirmedAt) {
          setMode('verify');
          try {
            const { error: profileError } = await supabase
              .from('user_profiles')
              .update({ email_verified: true })
              .eq('id', data.session.user.id);
            if (profileError) throw profileError;
            if (cancelled) return;
            setStatus('email-verified');
          } catch (err) {
            if (cancelled) return;
            setStatus('email-error');
            setError(friendlyMessage(err, 'Could not verify your email.'));
          }
          return;
        }

        setStatus('ready');
      } catch {
        if (cancelled) return;
        setStatus('error');
        setError('This link is invalid or has expired. Please request a new one.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('success');
    } catch (err) {
      setError(friendlyMessage(err, 'Could not update your password'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
        {status === 'verifying' && (
          <>
            <Loader2 size={32} className="text-thread mx-auto mb-3 animate-spin" />
            <h1 className="text-lg font-semibold mb-1">{mode === 'verify' ? 'Verifying your email…' : 'Verifying reset link…'}</h1>
            <p className="text-sm text-text-muted">Please wait a moment.</p>
          </>
        )}
        {status === 'email-verified' && (
          <>
            <MailCheck size={32} className="text-green-600 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Email verified!</h1>
            <p className="text-sm text-text-muted mb-5">Your email address has been confirmed. You're all set.</p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/app')}>
              Continue to Krayo <ArrowRight size={16} />
            </button>
          </>
        )}
        {status === 'email-error' && (
          <>
            <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Verification failed</h1>
            <p className="text-sm text-text-muted mb-5">{error}</p>
            <Link to="/signin" className="btn btn-ghost btn-sm">Back to sign in</Link>
          </>
        )}
        {status === 'ready' && (
          <div className="text-left">
            <h1 className="text-lg font-semibold mb-1 text-center">Set a new password</h1>
            <p className="text-sm text-text-muted mb-5 text-center">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit}>
              <div className="mb-3"><label className="label">New password</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /></div>
              <div className="mb-3"><label className="label">Confirm password</label><input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
              {error && <p className="text-xs text-red mb-3">{error}</p>}
              <button type="submit" className="btn btn-primary w-full" disabled={loading || !password.trim() || !confirmPassword.trim()}>{loading ? 'Updating…' : 'Update password'}</button>
            </form>
          </div>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={32} className="text-green-600 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Password updated!</h1>
            <p className="text-sm text-text-muted mb-5">Your password has been changed successfully. You can now sign in with your new password.</p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/signin')}>
              Sign in <ArrowRight size={16} />
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Reset link invalid</h1>
            <p className="text-sm text-text-muted mb-5">{error}</p>
            <Link to="/signin" className="btn btn-ghost btn-sm">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
