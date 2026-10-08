# Finance receipt delivery

Open `/?room=finance`. Sign in with the existing cockpit password. Camera capture,
multi-file upload and drag/drop accept JPEG, PNG, WebP or PDF, up to 3 MB per file.
HEIC photos must be converted to JPEG first. Originals are private and downloadable.
Content hashes catch the same file uploaded twice, including concurrent uploads.
The chosen business purpose, category and business percentage apply to the batch.

The capture store holds immutable supporting documents and delivery receipts, not
accounting balances. All records are unreviewed. Production uses a separate store
from each preview. The shared cockpit open-access switch never bypasses Finance
session checks. Each mutation checks the same-origin header. Private receipts are
not accessible through the generic cockpit/vault APIs.

## Receipt Wrangler connection

Receipt Wrangler is a separate open-source service, not a Netlify function.
Use the current official deployment instructions (app, database and Redis):
https://receiptwrangler.io/docs/getting-started/installation/
Configure persistent storage/backups, HTTPS, a private user/group and OCR/receipt
processing in that service before connecting it. Do not run the database in this
ephemeral workspace. Its licensing is GPLv3; this repository implements an API
adapter and does not copy Receipt Wrangler source.

Set these **server-side Netlify function environment variables**:

| Variable | Value |
| --- | --- |
| `RECEIPT_WRANGLER_URL` | HTTPS root of your actual hosted instance, without `/api` |
| `RECEIPT_WRANGLER_API_KEY` | Restricted API key with receipt create/quick-scan access |
| `RECEIPT_WRANGLER_GROUP_ID` | Sole trader group numeric ID |
| `RECEIPT_WRANGLER_PAID_BY_USER_ID` | Vinny's numeric user ID |

Redeploy after setting function variables. The Finance screen reports configured
settings only; it does not claim the service is reachable until a delivery succeeds.
Each saved document has a separate **Send for scanning** button. The adapter calls
`POST /api/receipt/quickScan` with multipart `files`, `groupIds`, `paidByUserIds`,
`statuses=DRAFT` and a comment carrying capture notes. The API key is passed as
`Authorization: v1...`, never exposed to the browser. API contract:
https://receiptwrangler.io/api/
https://raw.githubusercontent.com/Receipt-Wrangler/receipt-wrangler/refs/heads/main/api/swagger.yml

An immutable conditional attempt marker prevents repeated/concurrent sends. A
timeout or non-success response is shown as uncertain/attention and does not lose
the original. Do not automatically retry: the API has no documented idempotency
key. Reconcile its processing queue and server logs first. Accepted means the
quick-scan request returned success; extraction and expense approval still need
checking in Receipt Wrangler. Capture notes export as JSON, not a final P&L.

## Ireland category mapping

Category codes are internal labels; there is no universal Irish expense code set.
Suggested Form 11 box mappings are explicitly versioned to the **2025** published
form: https://www.revenue.ie/en/self-assessment-and-self-employment/documents/form11.pdf
Do not silently apply those box numbers to another filing year. Confirm freelancer
versus RCT treatment. Mixed-use expenses require an appropriate business split;
entertainment requires tax review; personal drawings are excluded and equipment
may require capital allowances. No VAT deduction or tax eligibility is inferred
from the presence of a receipt.

## Remaining accounting work

The receipt capture pipeline is not a complete accounts package. A year-end P&L
also needs revenue, bank reconciliation, refunds/credit notes, asset/depreciation
records and accountant-reviewed tax adjustments. Use a transactional accounting
database/ledger for those, not Netlify Blobs. Email ingestion can be configured in
Receipt Wrangler after its mailbox/credentials are available; no unverified
receipt inbox address is displayed in the cockpit.

## Validation

`node --test tests/*.test.js` and `npm run build`.
Then verify a real small receipt upload, original download and scan on the deployed
site with an authenticated session. Never test production using invented expenses.
