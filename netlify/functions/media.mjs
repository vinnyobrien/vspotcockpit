import { getStore } from '@netlify/blobs';
import { getAccessToken } from './_google.js';
import { requireAuth } from './_auth.js';

export const config = { path: '/api/media/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network - media intake
 *
 * Netlify Functions cap at 6MB in and 6MB out. A 19MB correspondent
 * video breaks that in both directions, and chunking only fixes the
 * inbound half - Metricool still needs to FETCH a public file.
 *
 * So the bytes never touch Netlify. This function opens a Google Drive
 * RESUMABLE upload session, the browser PUTs straight to the session
 * URI, and what comes back is a Drive file Metricool pulls from through
 * its own Drive integration. The size limit stops applying because
 * nothing large passes through here.
 *
 * Drive rather than object storage for two reasons. The Cockpit's Google
 * consent already carries drive.file - the narrowest write scope Google
 * offers, granting access ONLY to files this app itself creates - so
 * there is no new account and no new secret. And a linked Drive means
 * Metricool authenticates and pulls the real bytes; an unlinked one
 * returns the HTML viewer page and fails at publish time.
 *
 * Blobs holds only the registry - key, URL, size, tags. Small JSON.
 * ------------------------------------------------------------------ */

const media = () => getStore({ name: 'vspot-media', consistency: 'strong' });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

/* Two ways in, deliberately. The browser is already logged in with the
   session cookie every other function uses, so the room needs no token
   pasted into it. The bearer stays for the Cowork skills, which call these
   endpoints from outside a browser and have no cookie. */
function authorised(req) {
  const token = process.env.COCKPIT_TOKEN;
  if (token && (req.headers.get('authorization') || '') === `Bearer ${token}`) return true;
  return requireAuth(req) === null;
}

const FOLDER_KEY = 'drive/folder-id';
const FOLDER_NAME = 'VSpot Cockpit Media';

async function driveToken() {
  const t = await getAccessToken('default');
  if (!t) throw new Error('Google is not connected in the Cockpit. Press Connect Google in Settings, then try again.');
  return t;
}

/* One folder, created once, id cached. drive.file can see the folder it
   made and nothing else, so there is no search across the real Drive. */
async function folderId(token) {
  const store = media();
  const cached = await store.get(FOLDER_KEY, { type: 'json' });
  if (cached?.id) return cached.id;

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  if (!res.ok) throw new Error(`Drive refused the folder: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  await store.setJSON(FOLDER_KEY, { id, name: FOLDER_NAME, createdAt: new Date().toISOString() });
  return id;
}

/* Slug the filename rather than trusting it. Spaces and punctuation in an
   object key survive the upload and then break the URL Metricool fetches. */
function safeKey(filename) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dot = filename.lastIndexOf('.');
  const stem = (dot > 0 ? filename.slice(0, dot) : filename)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'clip';
  const ext = (dot > 0 ? filename.slice(dot + 1) : 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rand = Math.random().toString(36).slice(2, 7);
  return `${stamp}/${stem}-${rand}.${ext}`;
}

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.pathname.replace(/^\/api\/media\/?/, '').split('/').filter(Boolean);
  const route = seg[0] ?? '';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  try {
    /* POST /presign - mint a one-shot upload URL. The browser PUTs to it. */
    /* POST /presign - open a resumable session. The browser PUTs to the
       returned uploadUrl and reads the file id out of the final response. */
    if (route === 'presign' && req.method === 'POST') {
      const { filename, contentType = 'application/octet-stream' } = await req.json();
      if (!filename) return bad('filename is required');

      const token = await driveToken();
      const parent = await folderId(token);
      const key = safeKey(filename);
      const name = key.split('/').pop();

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': contentType
          },
          body: JSON.stringify({ name, parents: [parent] })
        }
      );
      if (!res.ok) return bad(`Drive refused the session: ${res.status} ${await res.text()}`, 502);

      const uploadUrl = res.headers.get('location');
      if (!uploadUrl) return bad('Drive opened a session but returned no Location header.', 502);

      return json({ ok: true, uploadUrl, key, contentType, resumable: true });
    }

    /* POST /share - make the uploaded file link-readable and hand back the
       URL. Separate from register because it needs the Drive id, which only
       exists once the PUT has finished. */
    if (route === 'share' && req.method === 'POST') {
      const { fileId } = await req.json();
      if (!fileId) return bad('fileId is required');
      const token = await driveToken();

      const perm = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
      if (!perm.ok) return bad(`Drive refused the share: ${perm.status} ${await perm.text()}`, 502);

      /* Metricool's Drive integration takes the standard file URL. The
         direct-download form is returned alongside it as a fallback, because
         which one Metricool prefers has not been confirmed against a real
         scheduled post yet. */
      return json({
        ok: true,
        fileId,
        publicUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
        directUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
      });
    }

    /* POST /register - record what landed, once the PUT succeeds. */
    if (route === 'register' && req.method === 'POST') {
      const body = await req.json();
      if (!body.key || !body.publicUrl) return bad('key and publicUrl are required');
      const rec = {
        key: body.key,
        publicUrl: body.publicUrl,
        fileId: body.fileId ?? null,
        kind: body.kind ?? null,
        filename: body.filename ?? null,
        bytes: body.bytes ?? null,
        durationSeconds: body.durationSeconds ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        /* The three tags every downstream question depends on. Nullable now,
           unrecoverable later - a clip filed untagged in September cannot be
           attributed in December. */
        origin: body.origin ?? null,          // original | guest-clip | podcast-cut | archive
        correspondent: body.correspondent ?? null, // murt | reagan | jimmy | house
        beat: body.beat ?? null,              // retail-media | agentic | uk | general
        note: body.note ?? '',
        uploadedAt: new Date().toISOString()
      };
      await media().setJSON(`media/${body.key}`, rec);
      return json({ ok: true, media: rec }, 201);
    }

    /* GET /list - recent uploads, newest first. */
    if (route === 'list' && req.method === 'GET') {
      const store = media();
      const { blobs } = await store.list({ prefix: 'media/' });
      const out = [];
      for (const b of blobs) {
        const rec = await store.get(b.key, { type: 'json' });
        if (rec) out.push(rec);
      }
      out.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
      return json({ ok: true, count: out.length, media: out.slice(0, 40) });
    }

    /* GET /check - is Drive wired up? Answers before you upload 19MB and
       find out. It proves the token refreshes; it cannot prove Metricool's
       own Drive link is on, which is a setting in their UI. */
    if (route === 'check') {
      try {
        const token = await driveToken();
        const me = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
          headers: { authorization: `Bearer ${token}` }
        });
        if (!me.ok) return json({ ok: false, ready: false, error: `Drive rejected the token: ${me.status}` });
        const { user } = await me.json();
        const parent = await folderId(token);
        return json({ ok: true, ready: true, drive: user?.emailAddress ?? null, folderId: parent, folder: FOLDER_NAME });
      } catch (e) {
        return json({ ok: false, ready: false, error: e.message });
      }
    }

    return bad(`unknown route "${route}". Try check, presign, share, register, list.`, 404);
  } catch (err) {
    return bad(err.message, 500);
  }
};
