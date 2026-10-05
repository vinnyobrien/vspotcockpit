# Substack in the Cockpit

Open Audience Stats, connect once, then use Refresh stats. The connection is stored in the existing server-only secrets store. Every analytics endpoint requires a signed Cockpit session even when COCKPIT_OPEN is enabled. The same-origin check protects connection changes and sync requests.

The connector calls the dashboard summary and paginated email_stats endpoints used by [tap-substack](https://github.com/tripleaceme/tap-substack). The Python extractor cannot execute inside Node-based Netlify functions, so the Cockpit uses those read-only endpoints directly with fetch, a 550ms throttle, bounded pagination and a background function. No subscriber list, subscriber emails or comments are fetched. Unknown fields are discarded. Cached analytics live in a separate server-only store, inaccessible through the generic Cockpit store API. A failed refresh leaves the last successful snapshot intact.

Dashboard summary fields retain the upstream reporting period. The publication-year selector filters per-post performance-to-date; it does not claim to measure events during that calendar year. Missing fields are unavailable, never assumed to be zero. Geography is not supplied. CSV downloads contain only the selected year of post metrics. Credentials are never included.

Optional server configuration: SUBSTACK_SESSION_TOKEN (a secret, never VITE-prefixed). Otherwise use the connection form with the value of substack.sid from the owner's authenticated dashboard. Session cookies can expire; reconnect when prompted. Disconnect removes the saved connection and cached stats; an environment-configured credential must be removed in Netlify separately.

Validation: node --test tests/substack.test.js and npm run build. An unauthenticated run of the original Python tap was attempted separately; live private extraction requires the owner's Substack session.

TikTok and YouTube: a dated aggregate Metricool snapshot can be imported from JSON into the private analytics store and is served only through the signed analytics API. No figures are bundled in the published source. It is not automatically refreshed. Coverage is partial; TikTok post views are performance to date, not calendar-period views. YouTube country shares require native verification before quoting viewer geography.
