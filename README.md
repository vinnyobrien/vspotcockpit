[README.md](https://github.com/user-attachments/files/30827018/README.md)
# vspotcockpit

Source for **The Cockpit** — the personal operations platform running at
`vspot-cockpit-vco.netlify.app`.

## Read this first

This repository does **not** yet contain the full source of the live site.

The Cockpit was deployed by Netlify Drop, never from Git, and the local folder
that was dropped no longer exists. What's here was reconstructed from the
deployed bundle. The 37 serverless functions the site depends on are running in
production but their source has not been recovered.

**Do not connect this repository to `vspot-cockpit-vco` until those functions
are in it.** Netlify deploys are atomic — a deploy from this repo would replace
the entire site, functions included, and publish a Cockpit with none of them.

The current production deploy is locked, which prevents exactly that.

## What's here

| File | |
|---|---|
| `API-CONTRACT.md` | Every endpoint, payload, Blob key and job flow, read off the deployed bundle. The rebuild is written against this. |
| `src/lib/api.js` | Transport layer built to that contract — auth wrapper, Blob read/write, job poller. |
| `src/lib/clip-selector.js` | Deterministic clip selection for the shorts desk. Fixes the repeating-six-clips bug. |
| `netlify.toml` | Recovered build config — build command, publish dir, `/api/*` redirect, security headers. |

## The live site

- Site: `vspot-cockpit-vco` · ID `4012fd19-baa0-43b6-8054-664a82f88395`
- Team: VSpotNewsChannel (Pro)
- Build: Vite → `dist`, functions in `netlify/functions`, esbuild bundler
- Routing: `/api/*` → `/.netlify/functions/:splat`, then SPA fallback
- Auth: same-origin session cookie set by `/api/login`; any 401 means re-auth
- State: Netlify Blobs, stores `cockpit` and `vault` — independent of deploys,
  so a front-end change cannot touch the data

### CSP constraint

`netlify.toml` sets `img-src 'self' data:` and `connect-src 'self'`, with no
`media-src` (so it falls back to `default-src 'self'`). External media —
OpusClip thumbnails and previews from `signed-ext.cdn.opus.pro` among them — is
blocked. Anything showing clip media needs a proxy function or a CSP amendment.

## Known bugs

**`clips-seen` does not persist.** The store holds 79 bytes — six clip IDs, one
session's worth, where it should accumulate toward 600. The Blob read helper in
the original swallowed every failure and returned its fallback, making a network
error indistinguishable from an empty key; the next write then persisted only
what was in memory. `src/lib/api.js` fixes this: a missing key returns the
fallback, a failed read throws, and `appendUnique()` re-reads before writing.

**The clip desk returns the same six clips.** Two causes. The count is
hardcoded (`ci(6)`), and the exclusion list is passed to the model as a prompt
hint rather than applied as a filter. `src/lib/clip-selector.js` filters in code
before the model sees anything, and rotates across themes so a day's picks
aren't three versions of one idea.

## Outstanding

- Recover the 37 functions (Netlify support, deploy `6a74f8f985cbbef379b6f092`)
- Rebuild the front end against the contract — ten screens, four tab groups
- Scheduled functions for the tweet queue (none exist: `function_schedules: []`)
