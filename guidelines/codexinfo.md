# Codex Project Handoff

This file is Codex's shared project memory for UniShip. It records the work
completed, the current deployment state, verification results, known issues,
and safe continuation instructions for another coding agent.

Last updated: June 19, 2026

## Agent communication protocol

Use these files as an asynchronous conversation between agents:

- Codex writes important findings and changes to `codexinfo.md`.
- Claude should write important findings and changes to `claudeinfo.md`.
- At the beginning of a task, each agent should read both files if they exist.
- Before changing code, compare the handoff notes with the current Git status
  and source files. The repository is always the final source of truth.
- After substantial work, update only your own information file unless the
  user explicitly asks you to edit the other agent's file.
- Never copy passwords, private keys, tokens, or environment variable values
  into either handoff file.
- Record exact commands, affected files, verification results, and unresolved
  risks so the next agent can continue without repeating the investigation.

## Current repository state

- Repository: `mittahateclub/uniship`
- Branch: `main`
- Commit at the time of this handoff:
  `f3cca7a66a31edf3c8fd85a88949670539a56941`
- Commit description: `GitHub Actions`
- Working tree was clean when this file was created.
- Node version: Node.js 22, configured in `.nvmrc`.
- Package manager: npm.
- Framework: Next.js 16.2.9 with React 19.2.7 and the App Router.
- Firebase project: `uniship-4c1a1`.

Do not stage, commit, push, reset, or discard changes unless the user
explicitly requests it. Preserve unrelated work in a dirty worktree.

## Production deployment

- Production URL:
  <https://my-app-phi-wine-87.vercel.app>
- The GitHub repository homepage points to:
  <https://my-app-phi-wine-87.vercel.app>
- Latest verified Vercel deployment commit:
  `f3cca7a66a31edf3c8fd85a88949670539a56941`
- The latest GitHub Actions CI run completed successfully on June 19, 2026:
  <https://github.com/mittahateclub/uniship/actions/runs/27821000400>
- The homepage and login page are prerendered and served from the Vercel edge
  cache.
- The user reported that the Firebase configuration was deployed.

The production homepage returned HTTP 200 with a Vercel cache hit. Five direct
requests measured approximately 78 to 113 milliseconds total response time
from the local test location.

## Environment variables

The application expects the following public Firebase variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

It also uses these server-side variables:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GROQ_API_KEY=
LLAMA_CLOUD_API_KEY=
CRON_SECRET=
```

`CRON_SECRET` is a private random password used by Vercel Cron when calling
`/api/jobs/process-tests`. A secure value was generated for the user, but it is
intentionally not stored in this repository or handoff. It must be configured
in Vercel's environment variables and may also be placed in `.env.local` for
local testing.

Never commit `.env.local`, service-account credentials, or the cron secret.

## Completed security and dependency work

- Fixed the original npm audit findings.
- Added dependency overrides for affected transitive packages.
- Current `npm audit --audit-level=low` result: zero vulnerabilities.
- Removed unused dependencies and unused font assets where identified.
- Source maps remain disabled in production.
- Added production security headers in `next.config.ts`, including CSP, HSTS,
  frame restrictions, referrer policy, and permissions policy.
- Firebase client initialization was split by responsibility:
  - `lib/firebase-app.ts` initializes the Firebase app.
  - `lib/firebase.ts` exports Authentication and Firestore.
  - `lib/firebase-storage.ts` loads Storage separately.

## Completed lint and documentation work

- Completed a repository-wide lint remediation.
- Rewrote `README.md` to document setup, environment variables, cron
  configuration, Firebase deployment, verification, and project structure.
- The rewritten README passed Markdown lint when it was checked.
- `LINT_HANDOFF.md` existed earlier in the work but is no longer present in the
  current repository.
- No lint rules were disabled as a shortcut.

## Completed performance and efficiency work

### Application loading

- Moved authentication providers out of the root public layout and into the
  protected application layout.
- Made the landing-page authentication redirect a dynamic client component.
- Dynamically loaded role-specific chat and notification components.
- Removed Lenis and simplified landing-page animation work.
- Improved image loading and proxy behavior.
- Removed a shared icon barrel bottleneck:
  - Deleted the old `components/icons.tsx` barrel.
  - Created individual icon modules under `components/icons/`.
  - Updated call sites to import individual icon modules.
- Enabled `optimizePackageImports` for Phosphor icons.

### Firestore and data access

- Bounded and cached Firestore queries that previously loaded excessive data.
- Reduced dashboard request fan-out.
- Added cursor pagination to large lists, including:
  - Applications
  - Events
  - Tests
  - Resumes
  - Results
  - Student and administrator directories
- Replaced repeated proctoring listeners with session metadata where possible.
- Added notification summary materialization and a summary API:
  - `app/api/notifications/summary`
  - `notification_summaries` Firestore rules
  - Summary-first reads in `lib/alerts.ts`

### Chat

- The closed chat UI now uses a lightweight unread listener.
- The full administrator inbox loads only when opened.
- Chat initially loads the newest 50 messages.
- Older messages are loaded explicitly through pagination.

### Test generation and background processing

- Added a durable Firestore-backed test-processing queue:
  - `app/actions/test-processing-jobs.ts`
  - `app/api/jobs/process-tests/route.ts`
  - `test_processing_jobs` Firestore rules and indexes
- Test creation now queues work and monitors job state.
- The browser starts new jobs immediately.
- Vercel Cron acts as a recovery worker when the browser disconnects.
- `vercel.json` runs the recovery worker daily at 03:00 UTC so it is compatible
  with Vercel Hobby.
- Vercel Pro can change the schedule to every minute if needed.
- Added document-processing input limits and timeouts.

### Code execution and grading

- Added global Judge0 concurrency control and retry handling.
- Added batch grading to `/api/compile` using batch mode.
- The test portal now sends one batch request instead of one request per test
  case.
- Isolated the exam timer to reduce unnecessary component rendering.

### Monitoring and budgets

- Added `components/WebVitalsReporter.tsx`.
- Added `/api/metrics/web-vitals`.
- Production logs receive structured Core Web Vital events for:
  - CLS
  - FCP
  - INP
  - LCP
  - TTFB
- Added `scripts/check-performance-budgets.mjs`.
- Added npm scripts:
  - `npm run typecheck`
  - `npm run check:perf`
  - `npm run ci`

## Current bundle budgets

The latest local performance-budget check passed:

| Surface | Gzip size | Budget |
| --- | ---: | ---: |
| Landing page | 224.6 KB | 230 KB |
| Dashboard | 390.0 KB | 450 KB |
| Proctoring | 396.4 KB | 450 KB |

The landing page has only about 5.4 KB of remaining budget, so new client-side
dependencies should be treated carefully.

## Production performance audit

The production audit was run against:
<https://my-app-phi-wine-87.vercel.app>

### Homepage

- Desktop Lighthouse performance: 97 to 100.
- Desktop FCP: approximately 0.27 seconds.
- Desktop LCP: approximately 0.47 to 0.74 seconds.
- Desktop TBT: 0 milliseconds.
- Mobile Lighthouse performance varied from 89 to 98.
- A representative mobile result:
  - FCP: 0.94 seconds
  - LCP: 2.72 seconds
  - TBT: 76 milliseconds
  - CLS: 0.0067
  - TTI: 4.76 seconds
- One slower mobile run reached an LCP of approximately 3.77 seconds.
- Mobile transfer size was approximately 673 KB over 34 requests.
- JavaScript transfer was approximately 463 KB over 17 script requests.

### Login page

- Mobile Lighthouse performance varied between 72 and 89.
- Mobile LCP was consistently around 3.6 to 3.7 seconds.
- TBT was approximately 98 to 134 milliseconds.
- Two of three runs reported CLS around 0.361.
- One run reported zero CLS, so the layout shift is intermittent but
  repeatable.
- Lighthouse attributed the shift to the mobile logo and late application of
  login layout styling.

### Accessibility and production diagnostics

The homepage Lighthouse audit also identified:

- Footer copyright contrast below the recommended ratio.
- Heading order skips from `h2` to `h4` in the four-step section.
- The content uses a `div` with `id="main-content"` instead of a semantic
  `<main>` landmark.
- `/favicon.ico` returns 404 and creates a browser console error.

### Primary remaining performance bottlenecks

1. The public homepage initializes Firebase Authentication through
   `components/LandingAuthRedirect.tsx`.
2. The Firebase initialization causes the public page to load:
   - Approximately 130 KB of unused JavaScript.
   - Approximately 90 KB for Firebase's authentication iframe.
   - Additional Google API scripts.
3. The login page imports Firebase Authentication and Firestore immediately in
   `app/login/page.tsx` instead of loading them when the form is submitted.
4. The landing and login pages contain large `styled-jsx global` blocks inside
   client components. The login CSS can be applied late enough to create a
   substantial layout shift.
5. Three local TTF files are preloaded globally:
   - Geist Variable, approximately 87 KB transferred.
   - Space Mono Regular, approximately 45 KB transferred.
   - Space Mono Bold, approximately 46 KB transferred.
6. Above-fold landing content begins hidden under `.reveal-block` and waits for
   an Intersection Observer before becoming visible.

## Recommended next performance changes

These changes were diagnosed but not implemented during the production audit:

1. Move landing and login styles out of client-component `styled-jsx` blocks
   and into statically loaded CSS modules or route CSS.
2. Dynamically import Firebase Authentication and Firestore inside the login
   submit handler.
3. Reconsider the automatic authenticated-user redirect on the public landing
   page. Prefer a lightweight session signal or load Firebase Auth after the
   initial page becomes interactive.
4. Render above-fold hero content visible immediately. Keep reveal effects for
   below-fold sections only.
5. Convert the local TTF files to WOFF2.
6. Avoid loading both Space Mono weights on routes that do not use them.
7. Add an application favicon.
8. Fix footer contrast, heading order, and the missing semantic `<main>`.

Measure before and after each change. The largest likely win is removing
Firebase Auth and its iframe from the anonymous landing-page path.

## Firebase rules and indexes

Firebase deployment command:

```powershell
firebase deploy --only "firestore,storage" --project uniship-4c1a1
```

The quotes are required in PowerShell around the comma-separated deployment
targets.

During deployment, Firebase reported remote indexes not originally present in
the local file. The user correctly selected **No** when asked whether to delete
them. Do not delete remote indexes blindly.

The following deployment conflicts were fixed:

- Removed explicit `__name__` fields from local composite-index definitions
  because Firestore manages them implicitly.
- Added the existing `applications` index to `firestore.indexes.json`.
- Removed an unnecessary `tests/startTime` composite index that Firestore
  requires to be configured through single-field controls instead.
- Matched the existing remote `generated_tests` and `users` indexes.

Important current composite indexes include:

- `generated_tests`: `universityId`, `status`, `createdAt`
- `users`: `universityId`, `createdAt`
- `applications`: `userId`, `appliedAt`
- `practice_problems`: `universityId`, `createdAt`
- `events`: `universityId`, `date`
- `internships`: `universityId`, `deadline`
- `notifications`: `userId`, `createdAt`
- `test_processing_jobs`: `status`, `createdAt`
- `chats`: university and activity/unread combinations
- `messages`: `internal`, `createdAt`

## GitHub Actions

The workflow is in `.github/workflows/ci.yml`.

Changes made:

- Updated `actions/checkout` from version 4 to version 5.
- Updated `actions/setup-node` from version 4 to version 6.
- Added npm dependency caching.
- Added persistent `.next/cache` caching.
- Disabled Next.js telemetry in CI.
- Added syntactically valid placeholder public Firebase values so static
  prerendering does not fail when repository variables are absent.
- CI runs:
  - `npm ci --ignore-scripts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm audit`
  - `npm run build`
  - `npm run check:perf`

The placeholder values exist only to permit build-time Firebase
initialization. They do not grant access to a real Firebase project.

The original CI failure was:

```text
Firebase: Error (auth/invalid-api-key)
```

It occurred while prerendering `/superadmin/create-uniadmin` because GitHub
Actions had no public Firebase variables. The current workflow fixes that
problem and the latest run passed.

## Verification commands

Run the complete local verification:

```powershell
npm run ci
```

Or run individual checks:

```powershell
npm run lint
npm run typecheck
npm audit
npm run build
npm run check:perf
```

At the time of this handoff:

- TypeScript passed.
- Performance budgets passed.
- npm audit reported zero vulnerabilities.
- The latest GitHub Actions workflow passed.
- The production site returned HTTP 200.

## Important implementation locations

- Landing page: `app/landing-page.tsx`
- Login page logic: `app/login/page.tsx`
- Login presentation and styles: `app/login/login.view.tsx`
- Root layout and fonts: `app/layout.tsx`
- Global animation styles: `app/globals.css`
- Landing auth redirect: `components/LandingAuthRedirect.tsx`
- Authentication context: `contexts/AuthContext.tsx`
- Firebase app initialization: `lib/firebase-app.ts`
- Authentication and Firestore exports: `lib/firebase.ts`
- Storage export: `lib/firebase-storage.ts`
- Web Vitals reporter: `components/WebVitalsReporter.tsx`
- Web Vitals endpoint: `app/api/metrics/web-vitals/route.ts`
- Test queue action: `app/actions/test-processing-jobs.ts`
- Test queue worker: `app/api/jobs/process-tests/route.ts`
- Judge0 helper: `lib/judge0.ts`
- Performance budgets: `scripts/check-performance-budgets.mjs`
- CI workflow: `.github/workflows/ci.yml`
- Vercel cron: `vercel.json`
- Firestore indexes: `firestore.indexes.json`
- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`

## Workspace constraints and cautions

- Do not expose the generated cron secret or any `.env.local` values.
- Do not delete Firebase indexes merely because the CLI says they are not in
  the local file. Confirm whether the application or remote project uses them.
- Do not start another development server if port 3000 is already occupied.
- Do not stop an existing development server unless the user asks.
- Preserve the current `.claude` support files:
  - `.claude/settings.json`
  - `.claude/shots/verify.mjs`
  - `.claude/shots/refs/`
- Avoid reintroducing a shared icon barrel.
- Keep large Firestore collections paginated.
- Keep Judge0 submissions batched and concurrency-limited.
- Do not move authentication providers back into the public root layout.
- Do not disable lint, TypeScript, security, or performance checks to make a
  build pass.

## Latest Codex note

The application is deployed and functional. Edge response time and desktop
performance are strong. The most valuable remaining work is improving the
anonymous landing and login paths by delaying Firebase, loading route styling
statically, reducing font payload, and fixing the intermittent login layout
shift. No production-performance fixes were applied after the audit; those
items remain available for the next agent.

## Counterpart reconciliation

Codex read `claudeinfo.md` on June 19, 2026. Claude's historical design ledger
contains useful context, but its current lint status and several architecture
statements describe an older repository state.

The following current facts were reverified directly:

- `npm run lint` exits successfully with zero reported findings.
- The earlier `95 errors / 27 warnings` lint backlog is complete.
- `components/icons.tsx` does not exist.
- `components/icons/` contains 99 individual icon modules.
- Current imports use individual icon paths rather than a shared icon barrel.
- Lenis has zero references in the application, components, libraries, or npm
  manifests.
- The durable test-processing worker and landing authentication redirect are
  present.
- The performance, queue, pagination, monitoring, Firebase deployment, and CI
  changes documented earlier in this file are newer than Claude's lint-era
  status section.

Treat the lint-remediation lock in `claudeinfo.md` as stale unless Claude
explicitly renews it after reading the current repository and this
reconciliation. Future agents should still claim specific files before
simultaneous edits.

### Message to Claude

Please refresh the "Current state", lint backlog, icon import guidance, Lenis
notes, and active-lock sections of `claudeinfo.md` before using them for new
work. The repository now passes ESLint and uses individual icon modules.

`claudeinfo.md` also contains plaintext smoke-test account details. Do not
commit that file while those values are present. Remove the credentials and
rotate them if they grant access to the deployed application. Handoff files
must document variable names and access procedures, never usable credentials.

Both `claudeinfo.md` and `codexinfo.md` are currently untracked. The repository
owner should review and commit sanitized versions if these files are expected
to survive cleanup between prompts. Codex will not stage or commit them without
an explicit request.
