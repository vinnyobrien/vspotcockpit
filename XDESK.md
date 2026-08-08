# The X Desk

Four satirical X posts a day, one per voice, all published from Vinny's own account.
Text only. Nothing posts itself.

## Files (all new, nothing existing is touched)

| File | What it is |
|---|---|
| `netlify/functions/_xdesk.js` | Feeds, slots, voices, RSS reader, story partitioning, prompts, Anthropic call, day build. All prompt text lives here on the server. |
| `netlify/functions/xdesk.js` | JSON API at `/api/xdesk` |
| `netlify/functions/xdesk-page.js` | The desk itself at `/api/xdesk-page`. Server rendered, zero JavaScript. |
| `netlify/functions/xdesk-build.js` | Scheduled build, 05:30 UTC daily |

No new dependencies. No change to `netlify.toml`, `package.json` or any React file.

## The four slots

| Slot | Time | Voice | Beat |
|---|---|---|---|
| The Kettle | 07:30 IST | Vinny | Irish, UK and EU. What happened while America slept. |
| Market Open | 12:30 IST / 07:30 ET | Reagan Doyle | Earnings, retail media, trends, brands |
| The Floor | 16:30 IST / 11:30 ET | Jimmy Vance | Logistics, fulfilment, payments, AI infrastructure |
| Last Orders | 21:00 IST / 16:00 ET | Murt Moriarty | Funding rounds, founder discourse, the absurd |

## Why no JavaScript

The cockpit ships a strict CSP with no `script-src`, so `default-src 'self'` blocks
inline scripts. Forms and links are not blocked, so the desk runs on plain HTML forms
and posts via X's own composer URL. It works under the existing policy, on a phone,
with no build step.

## Blob keys, all in the `cockpit` store

- `xdesk:day:YYYY-MM-DD` the board
- `xdesk:seen` rolling 600 story ids so nothing repeats
- `xdesk:feeds` optional feed override, falls back to the built in list
- `xdesk:ledger:YYYY-MM` what was marked done

## Guardrails

- Approval writes to the ledger. It never posts. Posting is a link out to X with the text prefilled.
- Anthropic calls share the existing `ratelimit:` daily cap with `claude.js`.
- Each slot gets a disjoint shortlist, so two slots physically cannot pick the same story.
- Retrieved headlines are treated as data, not instructions.
- Promotional feed items (ticket sales, webinars, deal posts) are filtered before the writer sees them.

## Adding it to the hub

One link, wherever the rooms live:

```jsx
<a href="/api/xdesk-page">The X Desk</a>
```

## If you later want it to post by itself

Add `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` and a
`xdesk-post.js` function. The approve path in `_xdesk.js` is the hook. Deliberately
not built, because draft only with a human in the loop is the standing rule.
