import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Trash2, Edit2, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { sendNotifications } from '../lib/notifications';
import { lookupUserEmails } from '../lib/user-lookup';
import type { Comment } from '../lib/types';

interface CommentPanelProps {
  projectId: string;
  orgId: string;
  itemType: string;
  itemId: string;
}

interface MentionableUser { id: string; email: string; display_name: string | null; }

export function CommentPanel({ projectId, orgId, itemType, itemId }: CommentPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('project_id', projectId)
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as Comment[]);
    setLoading(false);
  }, [projectId, itemType, itemId]);

  const fetchMentionableUsers = useCallback(async () => {
    const { data: memberships } = await supabase
      .from('org_memberships')
      .select('user_id')
      .eq('org_id', orgId);
    if (!memberships || memberships.length === 0) return;
    const userIds = memberships.map((m: { user_id: string }) => m.user_id);
    const [profilesRes, authRes] = await Promise.all([
      supabase.from('user_profiles').select('id, display_name').in('id', userIds),
      lookupUserEmails(userIds),
    ]);
    const emailMap = new Map(((authRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
    const nameMap = new Map((profilesRes.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    const users: MentionableUser[] = userIds
      .filter((id) => id !== user?.id)
      .map((id) => ({ id, email: emailMap.get(id) ?? '', display_name: nameMap.get(id) ?? null }));
    setMentionableUsers(users);
  }, [orgId, user?.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => { fetchMentionableUsers(); }, [fetchMentionableUsers]);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    const cursorPos = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
    } else {
      setShowMentions(false);
      setMentionStart(-1);
    }
  };

  const insertMention = (mentionUser: MentionableUser) => {
    const before = body.slice(0, mentionStart);
    const after = body.slice(mentionStart + mentionQuery.length + 1);
    const name = mentionUser.display_name || mentionUser.email.split('@')[0];
    const newVal = `${before}@${name} ${after}`;
    setBody(newVal);
    setShowMentions(false);
    setMentionStart(-1);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMentions = mentionableUsers.filter((u) => {
    const name = (u.display_name || u.email).toLowerCase();
    return name.includes(mentionQuery.toLowerCase());
  });

  const handleSubmit = async () => {
    if (!body.trim() || !user) return;
    setSubmitting(true);
    // Parse @mentions to extract user IDs
    const mentionedIds: string[] = [];
    for (const u of mentionableUsers) {
      const name = u.display_name || u.email.split('@')[0];
      if (body.includes(`@${name}`)) mentionedIds.push(u.id);
    }

    const { data, error } = await supabase.from('comments').insert({
      project_id: projectId,
      item_type: itemType,
      item_id: itemId,
      body: body.trim(),
      mentioned_user_ids: mentionedIds,
    }).select().single();

    if (!error && data) {
      setComments([...comments, data as Comment]);
      setBody('');
      // Send notifications to mentioned users
      if (mentionedIds.length > 0) {
        const actorName = user.email?.split('@')[0] ?? 'Someone';
        await sendNotifications({
          type: 'mention',
          recipientIds: mentionedIds,
          projectId,
          itemType,
          itemId,
          actorId: user.id,
          message: `${actorName} mentioned you in a comment`,
        });
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('comments').delete().eq('id', id);
    setComments(comments.filter((c) => c.id !== id));
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await supabase.from('comments').update({ body: editBody.trim(), edited_at: new Date().toISOString() }).eq('id', editingId);
    setComments(comments.map((c) => c.id === editingId ? { ...c, body: editBody.trim(), edited_at: new Date().toISOString() } : c));
    setEditingId(null);
    setEditBody('');
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-thread font-medium bg-thread-bg/50 px-1 rounded">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-muted"><MessageSquare size={15} /> Comments ({comments.length})</div>
      {loading ? <p className="text-sm text-text-muted">Loading comments…</p> : comments.length === 0 ? <p className="text-sm text-text-faint">No comments yet. Start the conversation.</p> : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="card p-3">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <textarea className="input text-sm" rows={2} value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
                  <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button></div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-thread flex items-center justify-center text-xs font-bold text-white shrink-0">{c.user_id === user?.id ? 'Y' : '?'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text">{renderBody(c.body)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-faint">{new Date(c.created_at).toLocaleString()}</span>
                        {c.edited_at && <span className="text-xs text-text-faint italic">edited</span>}
                        {c.user_id === user?.id && (<>
                          <button className="text-text-faint hover:text-thread" onClick={() => handleEdit(c)}><Edit2 size={12} /></button>
                          <button className="text-text-faint hover:text-red" onClick={() => handleDelete(c.id)}><Trash2 size={12} /></button>
                        </>)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-10 card shadow-lg p-1 min-w-[200px] max-h-40 overflow-y-auto animate-fade-in">
            {filteredMentions.slice(0, 5).map((u) => (
              <button key={u.id} className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-text hover:bg-paper rounded-lg transition-colors" onClick={() => insertMention(u)}>
                <AtSign size={12} className="text-thread" />
                <span className="truncate">{u.display_name || u.email}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea ref={textareaRef} className="input text-sm flex-1" rows={2} value={body} onChange={handleBodyChange} placeholder="Write a comment… Use @ to tag someone" disabled={submitting} />
          <button className="btn btn-primary btn-sm self-end" onClick={handleSubmit} disabled={submitting || !body.trim()}><Send size={14} /></button>
        </div>
      </div>
    </div>
  );
}
