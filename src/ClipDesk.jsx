import { useEffect, useState, useCallback } from 'react';
import { Inbox, BookOpen, Check, X, Trash2, RefreshCw, ExternalLink } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Clip Desk
 *
 * Reads /api/captures. Writes status changes back with PATCH.
 * Auth is the session cookie, same as the media room — no token in
 * the bundle, which matters because the repo is public.
 *
 * The desk is deliberately a reading room, not a capture room. Things
 * arrive here from the phone; what happens here is deciding what to
 * do with them. Hence status buttons rather than an upload box.
 * ------------------------------------------------------------------ */

const C = {
  ground: '#F5F3EE', card: '#FFFFFF',
  ink: '#141833', ink2: '#565C82', ink3: '#767CA0',
  red: '#B81A1D',
  apricot: '#FFE0CE', sky: '#D6E8F5', mint: '#D6EFE0',
  lilac: '#E2DDF7', sand: '#F2E6D0', blush: '#FFD8D9'
};

const DISPLAY = "'Big Shoulders Display', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

/* Tints cycle so a thread keeps the same colour across renders —
   colour as an index, not decoration. */
const TINTS = [C.sky, C.mint, C.lilac, C.sand, C.apricot, C.blush];
const tintFor = (s = '') =>
  TINTS[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TINTS.length];

const STATUSES = [
  { key: 'parked', label: 'Parked', icon: Inbox },
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'used', label: 'Used', icon: Check },
  { key: 'dropped', label: 'Dropped', icon: X }
];

function since(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function Pill({ children, bg = C.card, fg = C.ink2, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 999, padding: '4px 12px', fontSize: 12,
        fontFamily: MONO, letterSpacing: '0.01em',
        background: active ? C.ink : bg,
        color: active ? '#fff' : fg,
        border: `1px solid ${active ? C.ink : 'rgba(20,24,51,0.10)'}`,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {children}
    </button>
  );
}

export default function ClipDesk({ onClose }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('parked');
  const [thread, setThread] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const p = new URLSearchParams({ status });
      if (thread) p.set('thread', thread);
      if (q.trim()) p.set('q', q.trim());
      const res = await fetch(`/api/captures?${p}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `The desk did not come back (${res.status})`);
      setData(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [status, thread, q]);

  useEffect(() => { load(); }, [load]);

  async function move(id, next) {
    setBusy(true);
    try {
      const res = await fetch(`/api/captures/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Could not move that clip (${res.status})`);
      }
      await load();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await fetch(`/api/captures/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  const counts = data?.counts ?? {};
  const threads = Object.entries(data?.threads ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: C.ink }}>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 36, lineHeight: 1 }}>CLIP DESK</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill onClick={load}><RefreshCw size={11} style={{ verticalAlign: -1 }} /> Refresh</Pill>
          {onClose && <Pill onClick={onClose}>Close</Pill>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {STATUSES.map(s => (
          <Pill key={s.key} active={status === s.key} onClick={() => { setStatus(s.key); setThread(null); }}>
            <s.icon size={11} style={{ verticalAlign: -1 }} /> {s.label}
            {counts[s.key] != null && ` ${counts[s.key]}`}
          </Pill>
        ))}
      </div>

      {threads.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {thread && <Pill onClick={() => setThread(null)}>← all threads</Pill>}
          {threads.map(([t, n]) => (
            <Pill key={t} bg={tintFor(t)} fg={C.ink} active={thread === t}
                  onClick={() => setThread(thread === t ? null : t)}>
              {t} {n}
            </Pill>
          ))}
        </div>
      )}

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search titles, notes, links"
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 14,
          borderRadius: 14, border: '1px solid rgba(20,24,51,0.12)',
          background: C.card, color: C.ink, fontSize: 14, fontFamily: 'inherit'
        }}
      />

      {error && (
        <div style={{ background: C.blush, color: C.red, borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      {!error && data && data.captures.length === 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 24, marginBottom: 6 }}>
            {status === 'parked' ? 'NOTHING PARKED' : `NOTHING ${status.toUpperCase()}`}
          </div>
          <div style={{ color: C.ink2, fontSize: 14 }}>
            {status === 'parked'
              ? 'Share a story to the Cockpit from your phone and it lands here.'
              : 'Move a clip into this state and it shows up here.'}
          </div>
        </div>
      )}

      {data?.captures.map(c => (
        <div key={c.id} style={{
          background: C.card, borderRadius: 14, padding: 18, marginBottom: 10,
          opacity: busy ? 0.6 : 1
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.ink3 }}>
                {since(c.captured_at)} · {c.source}
                {c.seen_count > 1 && ` · seen ${c.seen_count}×`}
                {c.type === 'note' && ' · note'}
              </div>
            </div>
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer"
                 style={{ color: C.ink3, flexShrink: 0 }} aria-label="Open the original">
                <ExternalLink size={16} />
              </a>
            )}
          </div>

          {c.note && (
            <div style={{
              marginTop: 10, padding: 12, borderRadius: 14,
              background: C.ground, color: C.ink2, fontSize: 14, whiteSpace: 'pre-wrap'
            }}>
              {c.note}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            {(c.threads ?? []).map(t => (
              <Pill key={t} bg={tintFor(t)} fg={C.ink}>{t}</Pill>
            ))}
            <div style={{ flex: 1 }} />
            {STATUSES.filter(s => s.key !== c.status).map(s => (
              <Pill key={s.key} onClick={() => move(c.id, s.key)}>{s.label}</Pill>
            ))}
            <button onClick={() => remove(c.id)} aria-label="Delete this clip"
                    style={{ background: 'none', border: 0, color: C.ink3, cursor: 'pointer', padding: 4 }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

