# Business World

Business World is an interactive visual operating layer for companies, humans, and AI agents.
Most of the world is a simulation — but one workflow, the **Maya supplier exception workflow**,
is wired to real external systems and is the subject of this document.

## Real vs. simulated

| Agent / workflow | Status |
|---|---|
| Vitek (coding agent) | Simulated |
| Nova (cross-company design agent) | Simulated |
| CloudWorks (support agent) | Simulated |
| Treasury / payments | Simulated (no real money ever moves) |
| **Maya supplier exception workflow** | **Real**, gated behind explicit human approval at every side-effecting step |

The real loop:

```
Founder → Maya → create supplier Case → Gemini drafts an email → human approves
  → Gmail API sends the real email → wait for supplier
  → Gmail API sync retrieves the real reply → Gemini extracts structured facts
  → Maya returns with the reply → human decides (accept credit / escalate / etc.)
```

This is intentionally scoped as **"safe enough for a controlled two-account real test,"**
not enterprise production readiness. See "Known limitations" below.

## Architecture

- **Frontend**: React 19 + Vite, `src/`. `WorldContext.tsx` holds app state; `ApiClient`
  (`src/services/apiClient.ts`) is the only thing that talks to the server.
- **Domain model**: `src/domain/case/` — a pure, framework-free `Case` state machine
  (`types.ts`, `stateTransitions.ts`). Every status change goes through
  `VALID_CASE_TRANSITIONS` / `canTransitionCase`; transition functions assert against it
  internally, so business code cannot skip a status by calling a transition function directly.
- **Server**: Express, `server.ts` + `server/`.
  - `server/cases/` — `CaseRepository` (persistence), `CaseService` (orchestration:
    approval binding, Gmail calls, sender verification), `caseRoutes.ts` (HTTP).
  - `server/gmail/` — a thin wrapper over the Gmail REST API (`users.getProfile`,
    `messages.send`, `threads.get`).
  - `server/ai/` — Gemini-backed email drafting and reply parsing, each with a
    deterministic offline fallback that never invents facts.
  - `server/policy/actionPolicy.ts` — a small, deterministic (non-LLM) policy engine:
    approval gating, a prohibited-action list, and a regex-based bank-fraud/wire-instruction
    scanner that runs on every inbound reply regardless of what the LLM says.
  - `server/auth/requireAuth.ts` — the authentication boundary for all Case endpoints.

## Real Supplier Mode: what's actually enforced

1. **Server-side, content-bound approval.** Sending an email is a two-step domain
   operation (`recordDraftApproval` → `transitionToSent`), not a hardcoded
   `ActionPolicy.canSendEmail(true)`. An approval is bound to the exact recipient,
   subject, body, and `draftVersion` of the case at the moment of approval. Editing the
   draft afterward (`transitionToWaitingApproval`) clears the pending approval — an
   approval can never be reused against changed content.
2. **Send idempotency.** `CaseService` acquires a per-Case send lock (`server/locks/`)
   before doing anything else, so two concurrent `approve & send` requests for the same
   Case cannot both reach the Gmail API. Locally / on a traditional long-running host this
   is an in-process `Set` (`InMemorySendLock`); on Vercel it's a real distributed lock via
   Redis's atomic `SET NX` (`RedisSendLock`) — see "Deploying to Vercel" below for why the
   in-process version alone isn't enough there. A sequential duplicate request after the
   Case is `WAITING_REPLY`/`SENT` is rejected immediately without calling Gmail again.
3. **No invented facts.** `server/ai/supplierReplyParser.ts`'s offline fallback extracts
   only literal, verbatim text around known keywords (e.g. a day-of-week, "customs") — it
   never fabricates a specific time, cause, or document. `server/ai/supplierEmailDraft.ts`'s
   default draft never mentions logistics specifics (customs holds, freight tracking,
   chassis, assembly facilities) unless they were literally supplied as Case facts.
4. **Gemini output is validated, never trusted blindly.** `validateExtractedState()`
   checks types and ranges (finite confidence in `[0,1]`, non-negative bounded credit
   amounts, an allow-listed currency, real arrays, bounded strings) and drops anything
   that doesn't pass — it never coerces a malformed field into a plausible-looking
   invented value.
5. **Sender verification.** A reply's `From` address is compared against the Case's
   `contact.email` / `allowedCounterpartyEmails`. An unverified sender's message is
   recorded (for human review, tagged `senderVerified: false`) but **never** updates
   `extractedState` or advances the Case's status.
6. **Authenticated mailbox identity.** The connected mailbox address used to filter out
   "messages I sent myself" is derived server-side from `GmailClient.getProfile(accessToken)`
   — a client-supplied email address is never trusted for this purpose (the sync endpoint
   doesn't even accept one anymore).
7. **Security review is a blocking status, not just a banner.** A reply containing a bank
   account change, wire instruction, IBAN/SWIFT pattern, or similar (see
   `ActionPolicy.scanForFinancialFraud`) moves the Case to `SECURITY_REVIEW`. Resolving a
   Case in that status requires an explicit `securityReviewAcknowledged: true` — there is
   no path from a flagged message to an automatic resolution.
8. **Case API authentication.** Every `/api/cases/*` endpoint requires a Google OAuth
   access token that Gmail itself accepts (verified via `users.getProfile`); the verified
   email becomes the request's identity (used as `approvedBy`, etc). A random visitor to a
   public deployment cannot read or mutate real Case state.
9. **CORS.** Never a wildcard. Production allows only `APP_URL` (+ optional
   `ALLOWED_ORIGINS`); development allows common localhost dev ports.
10. **Token storage.** The Gmail OAuth access token lives in React state only — never in
    `localStorage`/`sessionStorage`/a file/a URL/a log. A page refresh requires
    reconnecting Gmail; that's an accepted limitation, not an oversight.
11. **Demo reset vs. real Case reset are separate code paths.** `WorldContext.resetDemo()`
    (the visual "reset demo world" action) never calls the real Case reset endpoint. Real
    Case data is only ever reset by an explicit, authenticated call to
    `POST /api/cases/reset` (`ApiClient.resetCases`) — a static regression test
    (`test/case.test.ts`, "K.") asserts `WorldContext.tsx` never calls it.

## Running it

```bash
npm install
cp .env.example .env   # fill in GEMINI_API_KEY, APP_URL, GOOGLE_CLIENT_ID
npm run dev             # http://localhost:3000, Vite dev middleware + API
```

Production:

```bash
npm run build
npm start                # NODE_ENV=production tsx server.ts, serves dist/ + API
```

`npm start` runs the TypeScript server directly via `tsx` (a devDependency) rather than
`node server.ts` — this project's `server.ts` uses ESM `import.meta` and top-level types
that plain Node cannot execute without a loader, so `npm ci` must install devDependencies
in the deployment image (the default; don't pass `--omit=dev`).

## Deploying to Vercel

This app also deploys to Vercel as a serverless project: `vercel.json` builds the Vite
frontend as static output and rewrites `/api/*` to a single Node function
(`api/index.mjs`) that wraps the exact same Express app used by `npm start` — same routes,
same auth middleware, same CORS config.

**Why persistence and locking are pluggable.** A serverless function has no persistent
filesystem and no memory shared across instances, so the file-backed `CaseRepository` and
the in-process `Set`-based send lock (correct for `npm start` on a long-running host) don't
work there. `server/cases/createCaseRepository.ts` and `server/locks/createSendLock.ts`
pick the right implementation automatically based on whether a Redis store is configured
(`serverConfig.useRedis`):

- **Not configured** (no Redis env vars): file-backed persistence + an in-process lock —
  this is what local dev, `npm start`, and the test suite always use.
- **Configured**: `VercelKvCaseRepository` (Case data as JSON in Redis, `server/cases/kvCaseRepository.ts`)
  + `RedisSendLock` (a real distributed lock via Redis's atomic `SET NX`,
  `server/locks/redisSendLock.ts`) — required for send-idempotency and Case persistence to
  actually work correctly across Vercel's concurrent, ephemeral function instances.

**Why the API is pre-bundled.** Vercel's Node builder transpiles `.ts` function files
per-file via `tsc` without rewriting this project's extensionless relative imports, and
plain Node's ESM loader (unlike `tsx`) does no extension inference — so a naively deployed
`api/index.ts` fails at runtime (`../server` is ambiguous with the `server/` directory and
throws `ERR_UNSUPPORTED_DIR_IMPORT`). `npm run build:api` uses `esbuild` (already a
dependency) to bundle `server.ts` and its whole local module graph into a single
`api/_app.mjs` ahead of time — esbuild resolves extensions/directories correctly, so only
real npm package imports (express, cors, `@upstash/redis`, etc.) are left for Node to
resolve normally from `node_modules` at runtime. `vercel.json`'s `buildCommand` runs both
`npm run build` and `npm run build:api`. `api/_app.mjs` is a gitignored build artifact,
regenerated on every deploy — never hand-edit it.

**Setup steps:**

1. `vercel deploy` (or connect the GitHub repo in the Vercel dashboard) — the CLI will
   detect `vercel.json` and deploy. `vercel deploy --prod` promotes to the production
   domain (preview deployments are gated behind Vercel's own SSO by default).
2. Add a Redis store: Vercel dashboard → Storage → Marketplace → a Redis integration
   (Upstash). This auto-injects `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or the
   legacy `KV_REST_API_URL`/`KV_REST_API_TOKEN` names some integrations still use — both
   are supported). Without this, the app still runs, but real Case data won't reliably
   persist across invocations.
3. Set `GEMINI_API_KEY` and `GOOGLE_CLIENT_ID` as project environment variables (Settings →
   Environment Variables). Without `GEMINI_API_KEY`, drafting/parsing silently uses the
   deterministic offline fallback (never crashes, just less capable).
4. `APP_URL`/`ALLOWED_ORIGINS` are optional on Vercel: the app's own production domain
   (`VERCEL_PROJECT_PRODUCTION_URL`) and current deployment domain (`VERCEL_URL`) are
   always auto-allowed for CORS, since Vercel injects both. Set `APP_URL` explicitly only
   if you attach a custom domain and want CORS to allow it too.
5. Add your Vercel domain(s) to the Google OAuth Client's "Authorized JavaScript origins"
   (see "Google OAuth setup" below) — Gmail Connect won't work from an origin Google
   doesn't recognize.

## Environment variables

See `.env.example`. In short: `GEMINI_API_KEY` (Gemini access — required for AI drafting/
parsing; falls back to a deterministic offline mode if unset), `APP_URL` (self-URL, also
the production CORS allowlist), `GOOGLE_CLIENT_ID` (Gmail OAuth client — not a secret),
`ALLOWED_ORIGINS` (optional extra CORS origins).

## Google OAuth setup (for the Gmail rail)

1. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.
2. Add your dev origin (e.g. `http://localhost:3000`) and your production `APP_URL` to
   "Authorized JavaScript origins".
3. Enable the Gmail API for the project.
4. Set `GOOGLE_CLIENT_ID` (or `firebase-applet-config.json`'s `oAuthClientId`).
5. In the app, click "Connect Gmail" — this uses Google Identity Services'
   `initTokenClient` (implicit token flow) with scopes `gmail.send`, `gmail.readonly`,
   `userinfo.email`. A manual bearer-token input exists in the Gmail connect modal for
   development/testing only.

## Tests

```bash
npm test     # NODE_ENV=test node --import tsx --test test/**/*.test.ts
```

- `test/case.test.ts` — the Case domain state machine, `ActionPolicy`, the AI-boundary
  no-invented-facts guarantees, `CaseRepository`'s deterministic active-case selection,
  and `CaseService`'s send-concurrency lock, authenticated-identity, and
  sender-verification behavior.
- `test/smoke.test.ts` — boots the real Express app (`server.ts`'s `createApp()`) on an
  OS-assigned ephemeral port and checks `/api/health`, `/api/gmail/status`, and the
  authentication boundary on `/api/cases`.

**None of this makes a live Gemini or Gmail call.** `NODE_ENV=test` forces
`serverConfig.geminiApiKey` to `''` (so the deterministic offline fallback always runs),
and `GmailClient`'s static methods are monkey-patched per-test. Every test constructs its
own `new CaseRepository({ filePath: null, autoSeed: false })` — an in-memory-only
repository — so the suite never reads or writes the developer's real `.data/cases.json`,
and tests don't share state or depend on run order.

A test-mode-only header, `x-test-session-email`, stands in for a verified Gmail identity
in `server/auth/requireAuth.ts` so the smoke test can exercise the authenticated code path
without a real OAuth token; it only works when `NODE_ENV === 'test'`.

## Security constraints (what's deliberately NOT possible)

- The AI can never send an email or accept a credit on its own — every side-effecting
  action requires a real, persisted, content-bound human approval (see above).
- Certain actions are hard-prohibited regardless of approval:
  `CHANGE_PO_QUANTITY`, `CHANGE_PRICE`, `ACCEPT_CONTRACTUAL_TERMS`, `PAY_MONEY`,
  `CHANGE_BANK_DETAILS` (`ActionPolicy.checkProhibitedAction`).
- No real payment/transfer of funds ever occurs anywhere in this app — "accepting a
  credit" only updates a Case record and the simulated invoice/treasury demo state.

## Known limitations (intentional, for this test scope)

- **File-backed persistence** (`.data/cases.json`) is single-process only. There is no
  multi-instance/concurrent-writer safety and it is not a durable database. Fine for one
  controlled test; do not run multiple server instances against the same data directory.
- **Send concurrency protection is in-process only.** The lock is a `Set` in server
  memory — it does not protect against two separate server processes/instances racing on
  the same Case.
- **No full IAM.** Authentication is "does Gmail accept this token," not a real user/role
  system. It exists only to keep a public deployment from being anonymously readable/
  writable.
- **A page refresh drops the Gmail connection** (by design — the access token is never
  persisted). Reconnect Gmail after a refresh.
- Sender verification trusts the `From` header's address (a standard, if spoofable,
  signal) — it is not S/MIME or DKIM-level verification. It is enough to catch a
  wrong-address reply or an obviously different sender; it is not a defense against a
  sophisticated header-spoofing attack on the wire.

## What is intentionally NOT implemented here

Explicitly out of scope for this hardening pass (future Business World architecture):
agent long-term memory, agent personality evolution, AI salaries, an agent marketplace,
BYO agent, A2A, MCP, real payments/banks/ERP integration, a real Vitek/Nova, new
buildings/map areas, or multiplayer.
