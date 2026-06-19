# Engineering Guidelines

How the UniShip codebase is built and the conventions any change must follow. This is a **stable
reference**. For current deployment state, the performance audit, and Firebase index history, see
`codexinfo.md`; for the design system see `DESIGN_GUIDELINES.md`.

## 1. Stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind CSS 4** (`@theme` in
  `app/globals.css`) · **TypeScript**.
- **Firebase** Authentication, Firestore, Cloud Storage. **Firebase Admin** server-side.
- **Groq SDK** + **LlamaParse** for AI test generation/parsing. **Judge0** for code execution.
- **Monaco** editor for coding assessments.
- Node.js 22 (`.nvmrc`); npm. Firebase project `uniship-4c1a1`.

## 2. Architecture

- **Controller / view split.** A route is a `page.tsx` (`'use client'`, owns data fetching, state,
  and handlers) that renders a presentational `*.view.tsx`. **Types are defined and exported from
  the view and imported by the controller** so `useState`, props, and updater callbacks share one
  type.
- **Route groups by role:** `app/(protected)/{user,uniadmin,superadmin}/…`. Public routes
  (landing, login) live outside `(protected)`.
- **Auth providers** live in the protected layout, **not** the public root layout — keep them
  there (moving them back regresses the anonymous-path bundle).
- **Important locations:** AI/compiler/domain utils in `lib/`; server actions + queue creation in
  `app/actions/`; API routes, workers, metrics in `app/api/`; shared UI in `components/`; auth in
  `contexts/AuthContext.tsx`.

## 3. Firebase layers — keep them separate

Client init is split by responsibility on purpose; do not merge:

- `lib/firebase-app.ts` — initializes the Firebase app.
- `lib/firebase.ts` — exports Auth and Firestore.
- `lib/firebase-storage.ts` — loads Storage separately.

Server-side uses Firebase Admin. **Never commit `.env.local`, service-account credentials, or
the cron secret.** The expected env vars are documented in the root `README.md`.

## 4. Data-access conventions

- **Bound and paginate.** Large collections use cursor pagination (applications, events, tests,
  resumes, results, student/admin directories). Do not load unbounded lists. Keep new list views
  paginated.
- **Summary-first reads.** Notifications use a materialized summary
  (`app/api/notifications/summary`, `notification_summaries` rules, `lib/alerts.ts`). Prefer a
  summary read over fanning out per-item reads.
- **Listeners.** The closed chat UI uses a lightweight unread listener; the full inbox loads only
  when opened; chat loads the newest 50 then paginates older. Proctoring favors session metadata
  over per-session listeners. Follow this "load detail on demand" pattern.
- Firebase policy files live in `firebase/`: indexes in `firebase/firestore.indexes.json`, rules
  in `firebase/firestore.rules`, storage rules in `firebase/storage.rules` (paths are wired in the
  root `firebase.json`). **Do not delete remote indexes** just because the CLI says they are not in
  the local file — confirm first (the owner intentionally keeps remote-only indexes). Deploy with:

  ```powershell
  firebase deploy --only "firestore,storage" --project uniship-4c1a1
  ```

## 5. Background processing & code execution

- **Test-document processing** uses a durable Firestore-backed queue
  (`app/actions/test-processing-jobs.ts`, `app/api/jobs/process-tests/route.ts`,
  `test_processing_jobs` rules/indexes). The browser starts jobs immediately; **Vercel Cron is a
  recovery worker** (`vercel.json`, daily 03:00 UTC for Hobby; can be per-minute on Pro). The
  worker is authorized by `CRON_SECRET` (see README).
- **Judge0** has global concurrency control + transient-retry handling (`lib/judge0.ts`).
  `/api/compile` grades in **batch mode** — the test portal sends one batch request, not one per
  test case. Keep submissions batched and concurrency-limited.

## 6. TypeScript & ESLint conventions

Lint is currently **clean (0 errors / 0 warnings)** and CI enforces it. Keep it that way. **Do
not disable lint, TypeScript, security, or performance checks to make a build pass**, and do not
edit the ESLint/TS config to silence a rule — fix the code.

### No `any` — type it properly

- Firestore timestamp-ish fields (`createdAt`, `appliedAt`, `submittedAt`, `date`, `deadline`,
  `publishedAt`) → type `unknown`, cast at the use site:
  `(row.createdAt as { toDate?: () => Date } | undefined)?.toDate?.()` (then `?? new Date(str)`).
- `Record<string, any>` → `Record<string, unknown>` (narrow per field).
- `catch (err: any)` → `catch (err)` + `err instanceof Error ? err.message : String(err)`.
- Icon/component props → `React.ComponentType<{ size?: number; className?: string }>`.
- **Firestore document objects → a named, exported `interface`** with `[k: string]: unknown`
  (lets `...snap.data()` spread cleanly), defined in the view, imported into the controller. Type
  all `.map`/`.forEach`/`.filter` callbacks with it. Guard label-map index access with `?? ''`.
- **Never** use `as any`, `@ts-ignore`, or `@ts-expect-error` to dodge a type.

### React-hooks rules (behavioral — touch live exam/proctoring/resume flows carefully)

- `static-components`: hoist components declared inside another component to module scope; pass
  former closures as props.
- `set-state-in-effect`: derive during render or compute in the event handler. A commented
  one-line suppression is acceptable **only** for a genuine SSR/portal mount-flag where removal
  causes a hydration mismatch.
- `purity`: no impure reads/calls in render (`ref.current`, `Date.now()`, `Math.random()`,
  mutation) → move to effect/handler/`useMemo`.
- `refs`: no `.current` access during render.
- `preserve-manual-memoization`: fix the dependency array, do not delete the memo.

### Imports

- Icons from `components/icons/` per-file modules — **never** `lucide-react`, never a re-added
  barrel (see Design Guidelines §7).

## 7. Performance budgets

`npm run check:perf` (`scripts/check-performance-budgets.mjs`) enforces gzip bundle budgets:

| Surface | Budget |
| --- | ---: |
| Landing page | 230 KB |
| Dashboard | 450 KB |
| Proctoring | 450 KB |

The **landing page is near budget (~8 KB headroom after the June 2026 public-route pass)** —
treat any new client-side dependency on the anonymous path with care. Public landing and login
routes must not eagerly load Firebase Auth or Firestore. Core Web Vitals are reported to
`/api/metrics/web-vitals`
(`components/WebVitalsReporter.tsx`) as structured `web_vital` events (LCP, INP, CLS, FCP, TTFB).

## 8. Verification

Run the full suite before considering work done:

```powershell
npm run ci    # lint + typecheck + audit + build + check:perf
```

Or individually: `npm run lint`, `npm run typecheck`, `npm audit`, `npm run build`,
`npm run check:perf`. GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on push/PR
with placeholder public Firebase vars so static prerendering does not fail.

To re-measure lint precisely: `npx eslint .` lints the whole tree (`npm run lint` runs bare
`eslint`). `npx tsc --noEmit` for types.

## 9. Standing workflow rules (for agents working in this repo)

1. **Never commit, push, or stage.** The owner commits + pushes after every prompt. Just edit
   files. Their routine **deletes untracked files between prompts** — any doc meant to persist
   (including the files in this `guidelines/` folder) must be `git add`-ed by the owner.
2. **Never stop the dev server** on port `:3000`; do not start a competing one if it is occupied.
3. **Prune `.claude/` each turn** to only the reusable assets: `.claude/settings.json`,
   `.claude/shots/verify.mjs`, `.claude/shots/refs/`. Delete `shots/out/*.png` and any temp
   scripts (`_*.mjs`, `_lint.json`, …).
4. **Do hard-to-reverse / outward-facing actions only with explicit approval.**

## 10. Gotchas

- **Stale `.next/types/validator.ts` tsc errors** referencing deleted pages are benign gitignored
  build-cache that self-heals on rebuild — filter them when reading `tsc` output.
- **ripgrep has no lookahead** (`(?!…)`) — it silently returns nothing. Use plain patterns.
- **Paths containing `[id]`** are glob character-classes — pass the literal path via the `path`
  parameter to file tools.
- See `DESIGN_GUIDELINES.md` §8 for the runtime gotchas (`position:fixed` transform trap +
  portals, hex-alpha + CSS-var tints, overflow clipping, hooks-before-early-return).
