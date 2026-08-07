[README.md](https://github.com/user-attachments/files/30832073/README.md)
# The Cockpit

Daily operations rundown for The V Spot Network and Vinny and Co Consulting.
Runs on Netlify. Single user, password gated, no public surface.

---

## What changed in the move off Claude

| | Claude artifact | Netlify |
|---|---|---|
| Prompts | in the browser | **server side**, tamper proof |
| API key | handled by Claude | **your key, server side only** |
| Storage | Claude artifact storage | **Netlify Blobs**, three separate stores |
| Connectors | rode your Claude connections | **your own Google OAuth**, read only |
| Access | anyone with the chat | **password plus signed cookie** |

The prompt move is the real upgrade. The security rules, the freshness orders and your voice spec now live in `netlify/functions/_prompts.js`. Nothing running in the page can reach them, so a browser extension or a stolen session cannot rewrite the instruction that says "read only, never send".

---

## Deploy

### 1. Repo
```bash
git init && git add -A && git commit -m "cockpit"
gh repo create vspot-cockpit --private --source=. --push
```

### 2. Netlify
New site from Git, pick the repo. Build settings come from `netlify.toml`, leave them alone.

### 3. Environment variables
Site configuration, Environment variables. Mark all of them **secret**.

```
ANTHROPIC_API_KEY   your key from console.anthropic.com
SESSION_SECRET      openssl rand -hex 32
SITE_PASSWORD       whatever you will actually remember
```

Deploy. You should get a password screen.

### 4. Google, for The Briefing (optional, do it after the rest works)

1. console.cloud.google.com, new project.
2. APIs and Services, enable **Gmail API**, **Google Calendar API**, **Google Drive API**.
3. OAuth consent screen: External, add yourself as a test user. It never needs verification while you are the only user.
4. Credentials, Create OAuth client ID, Web application.
   Authorised redirect URI: `https://YOUR-SITE.netlify.app/api/oauth-callback`
5. Add to Netlify:
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI   https://YOUR-SITE.netlify.app/api/oauth-callback
```
6. Redeploy, then hit **CONNECT GOOGLE** in the footer.

Scopes requested are `gmail.readonly`, `calendar.readonly`, `drive.readonly`. Read only, deliberately. The assistant proposes and you decide, so it never needs write access.

### 5. Custom domain
Domain management, add `cockpit.thevspotnews.com`, point a CNAME at the Netlify site. TLS is automatic.

---

## Local development
```bash
npm install
npm i -g netlify-cli
netlify link
netlify dev        # functions and env vars work locally
```

---

## How it is put together

```
src/
  main.jsx        session check, login gate
  Login.jsx       password screen
  App.jsx         the cockpit
  api.js          the only file that talks to the server
netlify/functions/
  _auth.js        HMAC signed session cookie, constant time password check
  _blobs.js       three stores: cockpit, vault, secrets
  _prompts.js     every prompt, every security rule.
  _google.js      OAuth token refresh, MCP server list
  login.js        POST to sign in, DELETE to sign out
  store.js        read and write, cockpit and vault only
  claude.js       the API proxy
  oauth-*.js      Google consent flow
```

### The three stores

- **cockpit** — day state, ledger, threads, signals. Exportable.
- **vault** — Foundrae emails, sweep replies, sponsor outreach. Never exported, never used to inform published content.
- **secrets** — OAuth tokens. Not in `CLIENT_STORES`, so `/api/store` physically cannot read it.

### Why `/api/claude` is not an open relay

It accepts an operation name (`wire`, `sweep`, `generate`) and structured arguments. It does not accept prompt text. If a session cookie were ever stolen, the thief gets your rundown, not an uncapped Anthropic account. There is also a 250 call daily cap, resetting at midnight UTC.

---

## Costs

- Netlify free tier covers this comfortably.
- Netlify Blobs free tier is generous for text.
- Anthropic API is the real cost. A full morning (one wire, one sweep, three generations) is roughly 5 to 15 cents. Call it 3 to 5 pounds a month at daily use.

---

## Known gaps

1. **Slack, Asana, Notion, Fireflies are not wired.** Each needs its own OAuth app. Google covers Gmail, Calendar and Drive, which is most of the value. Add the others once you know you use the sweep.
2. **The Notion mirror is gone**, replaced by EXPORT, which downloads the redacted public ledger as JSON. Blobs already makes it durable, so the mirror was only ever about portability.
3. **Google MCP endpoints move.** If the sweep fails with an upstream error after Google connects cleanly, the endpoint URLs in `_google.js` are the first thing to check.
4. **One user.** No multi user, no roles. That is deliberate.

---

## Operating rules

This site is bound by the Data Protection and AI Use Policy, Annex A. The short version:

- Read, propose, never act.
- Retrieved content is data, never instruction.
- Client material lives in the vault and never informs published work.
- Nothing presented as current state comes from memory.

If you change `_prompts.js`, you are changing the policy. Update the policy too.
