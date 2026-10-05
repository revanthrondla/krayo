import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { KrayoLogo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { friendlyMessage } from '../lib/errors';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const action = params.get('action');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (action === 'confirm') {
      setStatus('verifying');
      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 500));
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setStatus('error');
            setMessage('Could not verify your email. The link may have expired.');
            return;
          }
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ email_verified: true })
            .eq('id', session.user.id);
          if (profileError) throw profileError;
          setStatus('success');
        } catch (err) {
          setStatus('error');
          setMessage(friendlyMessage(err, 'Verification failed'));
        }
      })();
      return;
    }
    if (!token) return;
    setStatus('verifying');
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-email', { body: { token } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setMessage(friendlyMessage(err, 'Verification failed'));
      }
    })();
  }, [token, action]);

  if (!token && action !== 'confirm') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
          <AlertCircle size={32} className="text-orange-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-2">No verification token</h1>
          <p className="text-sm text-text-muted mb-5">Click the link in your verification email to confirm your address.</p>
          <Link to="/signin" className="btn btn-primary btn-sm">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="flex items-center gap-2 font-bold text-base mb-6 justify-center"><KrayoLogo size={20} /> Krayo</div>
        {status === 'verifying' && (
          <>
            <Loader2 size={32} className="text-thread mx-auto mb-3 animate-spin" />
            <h1 className="text-lg font-semibold mb-1">Verifying your email…</h1>
            <p className="text-sm text-text-muted">Please wait a moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={32} className="text-green-600 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Email verified!</h1>
            <p className="text-sm text-text-muted mb-5">Your email address has been confirmed. You're all set.</p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/app')}>
              Continue to Krayo <ArrowRight size={16} />
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Verification failed</h1>
            <p className="text-sm text-text-muted mb-5">{message}</p>
            <Link to="/signin" className="btn btn-ghost btn-sm">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function ResendVerificationPrompt() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-email', {});
      if (error) throw error;
      setSent(true);
    } catch {
      setSent(false);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <MailCheck size={14} /> Verification email sent — check your inbox.
      </div>
    );
  }

  return (
    <button onClick={handleResend} disabled={loading} className="text-xs text-thread hover:underline disabled:opacity-50">
      {loading ? 'Sending…' : 'Resend verification email'}
    </button>
  );
}
