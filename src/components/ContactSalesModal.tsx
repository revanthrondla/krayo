import { useState } from 'react';
import { Building2, Mail, User, Users, MessageSquare, ArrowRight, Loader2, Check, X } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { friendlyMessage } from '../lib/errors';

const TEAM_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

export function ContactSalesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', team_size: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setForm({ name: '', email: '', company: '', team_size: '', message: '' });
    setSubmitted(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.company.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('sales_leads').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        team_size: form.team_size || null,
        message: form.message.trim() || null,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err) {
      setError(friendlyMessage(err, 'Could not submit your request. Please try again.'));
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Contact Sales" maxWidth="max-w-lg">
      {submitted ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-text mb-1">Thanks for reaching out!</h3>
          <p className="text-sm text-text-muted mb-5">Our sales team will get back to you within one business day.</p>
          <button className="btn btn-primary btn-sm" onClick={handleClose}>Done</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Tell us about your team and we'll put together a plan that fits.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={User} label="Full name" required>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
            </Field>
            <Field icon={Mail} label="Work email" required>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
            </Field>
          </div>
          <Field icon={Building2} label="Company" required>
            <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corporation" />
          </Field>
          <Field icon={Users} label="Team size">
            <select className="input" value={form.team_size} onChange={(e) => setForm({ ...form, team_size: e.target.value })}>
              <option value="">Select…</option>
              {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field icon={MessageSquare} label="How can we help?">
            <textarea className="input" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your security, SSO, or data-isolation needs…" />
          </Field>
          {error && (
            <div className="text-xs text-red bg-red/5 border border-red/20 rounded-lg p-3 flex items-start gap-2">
              <X size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-ghost btn-sm" onClick={handleClose}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim() || !form.email.trim() || !form.company.trim()}
            >
              {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : <>Submit <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ icon: Icon, label, required, children }: { icon: React.ElementType; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Icon size={13} className="text-text-faint" /> {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
    </div>
  );
}
