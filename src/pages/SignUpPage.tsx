import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MailCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { KrayoLogo } from '../components/Logo';
import { friendlyMessage } from '../lib/errors';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [emailWarning, setEmailWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      await signUp(email, password);
      let emailDelivered = true;
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('send-verification-email', {});
        if (verifyError || verifyData?.error) {
          emailDelivered = false;
          console.error('Verification email send failed:', verifyError?.message ?? verifyData?.detail ?? verifyData?.error);
        }
      } catch (err) {
        emailDelivered = false;
        console.error('Verification email invoke failed:', err);
      }
      setVerificationSent(true);
      setEmailWarning(!emailDelivered);
      setTimeout(() => navigate('/app'), emailDelivered ? 2500 : 4000);
    } catch (err) {
      setError(friendlyMessage(err, 'Sign up failed'));
    }
    setLoading(false);
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <div className="card w-full max-w-sm p-7 text-center">
          <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
          {emailWarning ? (
            <>
              <AlertTriangle size={36} className="text-amber-500 mx-auto mb-4" />
              <h1 className="text-lg font-semibold mb-2">Account created</h1>
              <p className="text-sm text-text-muted mb-4">
                Your account is ready, but we couldn't send the verification email right now.
                You can resend it from the banner at the top of the app.
              </p>
              <p className="text-xs text-text-faint">Redirecting you to the app…</p>
            </>
          ) : (
            <>
              <MailCheck size={36} className="text-thread mx-auto mb-4" />
              <h1 className="text-lg font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-text-muted mb-4">
                We sent a verification link to <span className="font-medium text-text">{email}</span>.
                Click the link to confirm your email address.
              </p>
              <p className="text-xs text-text-faint">Redirecting you to the app…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm mb-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={15} /> Back to home
        </button>
      </div>
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
        <h1 className="text-xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-text-muted mb-5">Get started with Krayo</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3"><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
          <div className="mb-3"><label className="label">Password</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          {error && <p className="text-xs text-red mb-3">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>{loading ? 'Creating account…' : 'Sign up'}</button>
        </form>
        <p className="text-xs text-text-muted text-center mt-4">Already have an account? <Link to="/signin" className="text-thread hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
