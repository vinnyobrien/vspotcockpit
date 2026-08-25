import { getStore } from '@netlify/blobs';
import { AwsClient } from 'aws4fetch';

export const config = { path: '/api/media/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network - media intake
 *
 * Netlify Functions cap at 6MB in and 6MB out. A 19MB correspondent
 * video breaks that in both directions, and chunking only fixes the
 * inbound half - Metricool still needs to FETCH a public file.
 *
 * So the bytes never touch Netlify. This function mints a presigned
 * PUT against Cloudflare R2, the browser uploads straight there, and
 * what comes back is a public URL Metricool can pull from. The size
 * limit stops applying because nothing large passes through here.
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

function authorised(req) {
  const token = process.env.COCKPIT_TOKEN;
  if (!token) return true;
  return (req.headers.get('authorization') || '') === `Bearer ${token}`;
}

function config_() {
  const {
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET: bucket,
    R2_PUBLIC_URL: publicBase
  } = process.env;
  const missing = Object.entries({ R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, R2_PUBLIC_URL: publicBase })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Not set on this site: ${missing.join(', ')}`);
  return { account, accessKeyId, secretAccessKey, bucket, publicBase: publicBase.replace(/\/$/, '') };
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
    if (route === 'presign' && req.method === 'POST') {
      const { filename, contentType = 'video/mp4' } = await req.json();
      if (!filename) return bad('filename is required');

      const cfg = config_();
      const key = safeKey(filename);
      const target = `https://${cfg.account}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;

      const aws = new AwsClient({
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        service: 's3',
        region: 'auto'
      });

      /* Presigned for 15 minutes. Long enough for a slow upload on Kerry
         broadband, short enough that a leaked URL is worthless by teatime. */
      const signed = await aws.sign(
        new Request(`${target}?X-Amz-Expires=900`, { method: 'PUT' }),
        { aws: { signQuery: true, allHeaders: false } }
      );

      return json({
        ok: true,
        key,
        uploadUrl: signed.url,
        contentType,
        publicUrl: `${cfg.publicBase}/${key}`,
        expiresIn: 900
      });
    }

    /* POST /register - record what landed, once the PUT succeeds. */
    if (route === 'register' && req.method === 'POST') {
      const body = await req.json();
      if (!body.key || !body.publicUrl) return bad('key and publicUrl are required');
      const rec = {
        key: body.key,
        publicUrl: body.publicUrl,
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

    /* GET /check - is R2 wired up? Answers before you upload 19MB and find out. */
    if (route === 'check') {
      try {
        const cfg = config_();
        return json({ ok: true, bucket: cfg.bucket, publicBase: cfg.publicBase, ready: true });
      } catch (e) {
        return json({ ok: false, ready: false, error: e.message });
      }
    }

    return bad(`unknown route "${route}". Try check, presign, register, list.`, 404);
  } catch (err) {
    return bad(err.message, 500);
  }
};
