import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { KrayoLogo } from '../components/Logo';
import { useOrg } from '../lib/org-context';
import { friendlyMessage } from '../lib/errors';

export function NewOrgPage() {
  const navigate = useNavigate();
  const { createOrg } = useOrg();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const org = await createOrg(name.trim());
      navigate(`/app/orgs/${org.id}/settings`, { replace: true });
    } catch (err) {
      setError(friendlyMessage(err, 'Failed to create organization'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <Link to="/" className="mb-8">
        <KrayoLogo />
      </Link>
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={20} className="text-thread" />
          <h1 className="text-xl font-semibold">Create your organization</h1>
        </div>
        <p className="text-sm text-text-muted mb-5">
          You need an organization before you can start using Krayo.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="orgName">Organization name</label>
            <input
              id="orgName"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Acme Corp"
            />
          </div>
          {error && <p className="text-xs text-red mb-3">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
