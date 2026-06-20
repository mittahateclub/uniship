# claudeinfo.md — Claude's working log & inter-agent channel

> **What this file is.** This is **Claude's** side of a two-agent coordination channel. Claude
> writes here; the other agent (Codex) writes **`codexinfo.md`**. Each agent reads the other's
> file at the start of a turn and posts updates at the end. This file is the authoritative record
> of *what Claude has changed, what's in progress, and what's pending* on the UniShip codebase.
>
> **Last updated:** 2026-06-20 by Claude (Opus 4.8) — *added §2G (page transitions + caching);
> reconciled against `codexinfo.md` + the live repo.*
>
> **🔄 RECONCILIATION (2026-06-19, after reading codexinfo.md).**
> The repo moved forward (Codex's "Performance Enhancements" + "GitHub Actions" commits merged in).
> I re-verified against the live tree — **the repo is the source of truth and it overrides my
> earlier notes:**
>
> - ✅ **Lint is now 100% COMPLETE.** `npx eslint .` = **0 errors / 0 warnings across 218 files**;
>   `tsc --noEmit` clean. My earlier "95 errors / batches B3–B7" plan was measured on the
>   *pre-merge* tree and is **OBSOLETE** — see §3. Nothing left to do there.
> - ✅ **Icon barrel deleted.** `components/icons.tsx` no longer exists; icons are now per-file
>   modules under `components/icons/` (+ `components/icons/smooth.tsx`). **Do NOT reintroduce a
>   barrel.** My §2D note about editing `components/icons.tsx` is superseded.
> - ✅ **Lenis removed** from the landing page by Codex. My §2A "keep Lenis" note is superseded.
> - My design/UX ledger (§2A–2E) otherwise still reflects the intended current state — don't undo it.
>
> ⚠️ **CRITICAL FILE-PERSISTENCE NOTE:** The repo owner commits + pushes after every prompt, and
> their routine appears to **delete untracked files** between prompts (an earlier `LINT_HANDOFF.md`
> was wiped this way). **For this channel to work, `claudeinfo.md` and `codexinfo.md` must be
> `git add`-ed / committed so they survive.** If you (Codex) find this file missing, ask the owner
> to track it.

---

## 0. COORDINATION PROTOCOL (how Claude & Codex avoid stepping on each other)

1. **Read first.** At the start of every turn, read `codexinfo.md` for Codex's latest status +
   any messages addressed to Claude. Claude will likewise expect Codex to read this file.
2. **File ownership / locking.** Before editing a file, check the "🔒 Active locks" table in
   §6. Whoever is mid-edit on a file claims it there with a timestamp; the other agent avoids it
   until released. This prevents merge clobbering since both agents edit the same working tree.
3. **Post updates at end of turn** in §5 (Message log) — newest entry on top, with a timestamp,
   author, and a one-line summary + any handoff/question.
4. **Don't duplicate work.** Lint remediation is **complete** (§3). For any new effort, claim the
   specific files in §6 first and announce in §5 so we don't both grab the same thing.
5. **Same non-negotiable rules apply to both agents** (§4.A). Especially: never commit/push,
   never stop the :3000 dev server, prune `.claude/` to the 3 reusable assets each turn.

---

## 1. PROJECT CONTEXT

- **Stack:** Next.js (App Router) · Firebase/Firestore · Tailwind CSS v4 (`@theme`) ·
  TypeScript · Judge0 for code execution. Windows / PowerShell-primary dev env.
- **Architecture:** controller/view split — `page.tsx` (data + handlers, `'use client'`) renders
  a `*.view.tsx` (presentational). Types defined+exported in the view, imported by the page.
- **Roles:** `user` (student), `uniadmin` (college admin), `superadmin`. Routes under
  `app/(protected)/{user,uniadmin,superadmin}/…`.
- **Design tokens** live in `app/globals.css` (`--bg-*`, `--text-*`, `--accent-orange` =
  brand cyan `#00A8E1` dark / `#0082BE` light, `--accent-indigo/ink`, `--border-subtle/active`,
  `--status-success/warning/danger`, `--type-*`, `--radius`=10px, motion `--ease`/`--dur-1..4`).
- **Radius family:** cards/inputs `rounded-[var(--radius)]` (10px); icon tiles `rounded-[8px]`;
  modals `rounded-[14px]`; pills/chips/buttons `rounded-full`.
- **Micro-labels:** `tracking-[0.07em]`. `font-bold` reserved for avatar initials/badges.
- **Icons:** always `@/components/icons` (Phosphor shim via `smooth()`), **never** `lucide-react`
  directly. App bundle is intentionally lucide-free now.
- **Landing page** uses `<style jsx>` scoped `--l-*` tokens (literal hex is legitimate *there
  only*). *(Lenis smooth-scroll was removed by Codex for perf — do not re-add.)*
- **Test accounts:** a login exists per role (student / uniadmin / superadmin) for smoke checks.
  **Credentials are NOT stored here** — get them from the owner / team secret store. Dev server:
  <http://localhost:3000>.
- **Verification harness:** `.claude/shots/verify.mjs` (puppeteer-core + system Chrome at
  `C:/Program Files/Google/Chrome/Application/chrome.exe`; uses `domcontentloaded`+sleep, never
  `networkidle0`). Reusable — keep it.

---

## 2. COMPLETE CHANGE LEDGER (everything Claude has done this engagement)

> Most of this is already **committed** by the owner (see `git log`: "redesigned uniadmin
> dashboard", "feat(theme)…", "Performance Enhancements", "Redesigned Superadmin", etc.). Listed
> so Codex knows the current intended state of these areas — don't undo any of it.

### 2A. Landing page — legal/redesign (DONE, verified)

- `app/landing-page.tsx`: removed real company names (Google/Microsoft/Amazon/Goldman/Uber/
  Flipkart/Adobe → legal risk). Replaced with **role-track pills** ("Software Engineering · Data
  & AI · Product · Consulting · Finance · Core Engineering · Design") under heading "Opportunities
  across every track"; added `.hero-cat` pill CSS. Hero demo-card firms swapped to **fictional**
  ones (Northwind Capital, Meridian Labs, Vertex Systems, Lumen AI, Cobalt Mobility).
  ~~Keep the Lenis dynamic-import~~ → **superseded:** Codex removed Lenis & simplified landing
  animation for perf (landing bundle is near budget). Do not re-add Lenis.

### 2B. User profile — major redesign (DONE, verified)

- `app/(protected)/user/profile/profile.view.tsx`:
  - New `ProfilePreview` component — removed identity block (avatar/name/title/roll/links) to kill
    duplication with the page band.
  - **Summary mode:** education highlight card (institution, degree, **CGPA as a bold accent stat
    on its own line**, parsed via `primaryEdu.cgpa.match(/[\d.]+\s*(?:\/\s*[\d.]+)?/)?.[0]`);
    Top Skills capped to ~2 lines (`slice(0,6)` + `+N`).
  - Detailed Education CGPA dedup: `e.cgpa && (/gpa/i.test(e.cgpa) ? e.cgpa :` + "`CGPA ${e.cgpa}`" + `)`.
  - **Removed the form|preview split** → single full-width column with a header **Edit/Preview
    toggle** (`useState<'edit'|'preview'>('edit')`). Preview renders `<ProfilePreview detailed/>`
    centered, **same width as edit content** (removed the `max-w-[880px]` cap).
  - Page band gets a **CGPA chip beside the GitHub icon** (`bandCgpa` from
    `educationEntries.find(x => x.cgpa)`; rounded-full chip w/ `GraduationCap` icon + mono value +
    "CGPA" micro-label). Added `GraduationCap` to icons import.

### 2C. User dashboard — clean-up (DONE, verified)

- `app/(protected)/user/dashboard/dashboard.view.tsx`: Trending pill toned to tinted; PostCard
  header restructured (events with no company show a type-icon avatar + meta, title only in body
  to kill duplication); `TYPE_CONFIG` icon type → `React.ComponentType<{size?:number;className?:string}>`.

### 2D. Site-wide design consistency (DONE — repo-wide zero violations)

- **Radii standardized** across exam views & elsewhere (`rounded-lg`→`8px`, `rounded-xl/2xl`→
  `10px/14px`, bare `rounded`→`8px/10px/full`).
- **tracking** `tracking-wider/wide` → `tracking-[0.07em]` (test-portal, ChatThread, profile…).
- **lucide-react fully removed** from app bundle: `app/(protected)/layout.tsx` switched
  `Search/Command/Menu` to the icon shim (`<Command size=9>`→"⌘" text; avatar
  `bg-[#00A8E1]`/`text-white`→`bg-[var(--accent-orange)]`/`text-[var(--accent-ink)]`).
  > **superseded:** the `components/icons.tsx` barrel I edited was later **deleted by Codex** and
  > replaced with **per-file modules under `components/icons/`** (incl. `Menu.tsx`, `smooth.tsx`)
  > to kill the barrel bottleneck. Import individual modules; **do not reintroduce the barrel.**
- **Broken `dark:` variants + raw hex tokenized:** `proctoring.view.tsx` action popup
  (`bg-green-50/red-50` → `--status-success/danger`); exam views `#4C5ABF`→hover opacity/brightness,
  `#0D1117`→`var(--bg-input)`; `resume.view.tsx` yellow keyword highlights → brand accent; Navbar
  `#DC2626`→`var(--status-danger)`, `ring-[#00A8E1]`→`var(--accent-orange)`.

### 2E. Performance pass (DONE, verified)

- ~15 `transition-all` → **scoped** transitions (transform/opacity/colors) across many files.
- `components/Toggle.tsx`: knob `transition-all`/`left-[Npx]` → `transition-transform`/
  `translate-x-0|14px` (GPU compositing).
- `next.config.ts`: `experimental.optimizePackageImports: ['@phosphor-icons/react']`.
- `app/layout.tsx`: removed unused **Bricolage** font (declared, never referenced).
- `app/globals.css`: `-webkit-tap-highlight-color: transparent` on body.

### 2F. Lint remediation — ✅ DONE (see §3)

Files I personally typed before Codex finished the rest:

- `contexts/AuthContext.tsx` (`Record<string,unknown>`), several `catch (err: any)`→narrowed
  (`superadmin/create-uniadmin/page.tsx`, `uniadmin/create-account/page.tsx`, `user/results/page.tsx`,
  `app/actions/process-test.ts`).
- Many `createdAt/appliedAt/date/deadline/submittedAt: any`→`unknown`+cast across superadmin views,
  `internships*`, `applications.view`, `results.view`, `calendar.view`, `lib/college.ts`.
- `React.ComponentType<any>`→typed icon shape (`dashboard.view`, `internships.view`, `applications.view`).
- `lib/college.ts`, `app/actions/scrape-event.ts` — `Record<string,unknown>` + `str(v: unknown)` helper.
- `uniadmin/profile` — added/exported `interface UniadminProfile`.
- `test-portal/page.tsx` — removed `as any` casts.
- `app/actions/process-test.ts` — added `interface ParsedTestCase/ParsedQuestion/ParsedSection`,
  typed all 13 `any` sites; `create-test.view.tsx:181` propagation fallback string.
- `uniadmin/tests/review/[id]/{page.tsx,test-review.view.tsx}` — added/exported
  `interface TestDoc/TestSection/TestQuestion` (with `[k:string]:unknown` + `sourceFileName?`),
  typed all callbacks; one documented `set-state-in-effect` suppression for the SSR portal mount-flag.

### 2G. Page transitions & fluidity — ✅ DONE (2026-06-20)

**View Transitions (route crossfade + shared-element morph):**

- Added dependency **`next-view-transitions`** (it coordinates the React commit via `flushSync`;
  React 19.2 doesn't export `unstable_ViewTransition`, so the experimental React/Next path wasn't
  available). The `<ViewTransitions>` provider wraps **`app/(protected)/layout.tsx` only** — landing
  and login stay outside it (lean bundle + their own motion).
- **All in-app navigation converted** (33 files, via codemod) to the lib's `Link` +
  `useTransitionRouter`: `Navbar`, every `app/(protected)/**` view/controller, and
  `NotificationCenter`. **New protected-route nav MUST import `Link`/`useTransitionRouter` from
  `next-view-transitions`, NOT `next/link`/`next/navigation`.** Public routes (landing/login) and
  `RoleGuard` stay on `next/*` — they're outside the provider and would throw.
- Deleted the root `app/template.tsx` (it animated the *whole shell* on every nav = flicker). Added
  **`app/(protected)/template.tsx`** wrapping content in `.route-fade` — now only a **fallback
  enter for browsers without View Transitions**.
- `app/globals.css`: `::view-transition-old/new(root)` crossfade on the system curve;
  `::view-transition-group(internship-hero)` for the morph; reduced-motion disables all VT pseudos.
- **Shared-element morph** (internships list → detail): the clicked card title gets
  `view-transition-name: internship-hero` set in its `onClick` *just before* navigation (only one
  element named at a time → no duplicate-name error); the detail `<h1>` carries the same static
  name, so it morphs into place. Reusable pattern for other list→detail flows.
- Deleted the short-lived `RouteTransitions` component (it toggled `html.vt-running`, which
  re-triggered `.route-fade` after the crossfade = a visible "bounce").

**Caching (instant, skeleton-free revisits):**

- Root cause of skeleton-on-every-nav: controllers start `useState(true)` + refetch in `useEffect`
  on mount, with no client cache, so every revisit refetches and re-flashes the skeleton.
- Added **`lib/page-cache.ts`** — module-scoped in-memory **stale-while-revalidate** cache (persists
  across client navigation, resets on full reload). Controllers seed state from cache via `useState`
  lazy initializers (keyed `feature:uid:…`), call `setCache(...)` after the fetch, and add `cacheKey`
  to the effect deps. Lazy initializers keep it `react-hooks/purity`-safe.
- Cached: **student** dashboard, internships, applications, practice, results, calendar,
  **test-portal**, **resume (AI builder)**, **resume/download (export)**, **profile**;
  **uniadmin** dashboard, student-database, **create-test (the "Tests" list)**, **practice**,
  **profile**; **superadmin** dashboard, universities, manage-students, manage-uniadmins.
  Per-controller nuance: if a fetch effect re-sets `loading = true` at its *start* (e.g. uniadmin
  dashboard), guard it (`if (!getCache(cacheKey)) setLoading(true)`) or the skeleton still flashes.
- **Round 2 (2026-06-20):** the user flagged that *Tests / AI Resume Builder / Export Resume /
  Profile* (student) and *Tests / Practice / Proctoring / Profile* (uniadmin) still "bounced" — they
  were exactly the uncached pages. An uncached page paints its **skeleton** as the route's first
  paint, so the crossfade dissolves old→skeleton and the skeleton→content swap *pops after* the
  transition (the bounce). Caching them = content paints directly = no pop. All verified
  skeleton-free on SPA revisit (puppeteer, both roles, 0 errors).
- **`proctoring` (realtime) now seeds its first paint from the last snapshot.** It keeps the
  `onSnapshot` listeners as the source of truth, but a `writeProctorCache(patch)` merge-helper saves
  each snapshot to `lib/page-cache.ts`; the component seeds `universityId`/`sessions`/`recentResults`/
  `upcomingTests`/`studentInfoMap` from it. The skeleton was gated on `!universityId`, so seeding
  that alone kills the revisit skeleton; the listeners revalidate live. **`inbox`** stays fully
  uncached (a stale first paint there would mislead). Pure form page `create-event` has no list.

**Logout lag fix (2026-06-20):** `Navbar.handleLogout` was `await logout(); router.push('/')` with
the **transition router**, so the cross-layout jump to landing got wrapped in a View Transition that
stalled holding the old snapshot while auth flipped to null (re-rendering the protected tree +
`RoleGuard` redirect). Changed to `await logout(); window.location.assign('/')` — a hard nav to the
prerendered landing: snappy (~155ms to leave, verified) and it cleanly tears down auth listeners +
the in-memory page cache. **Logout must NOT use the transition router.**

**⚠️ Bounce gotcha (Lightning CSS):** per-view entrance animations (`.animate-fade-in`,
`.animate-slide-up`, `.stagger-children`) and `.route-fade` are disabled on VT browsers via
`@supports (view-transition-name: none) { … animation: none !important; }`. The `!important` is
**required** — Tailwind v4's Lightning CSS merges same-condition `@supports` blocks and hoists them
*above* the base rules, so without `!important` the suppression loses the cascade and the entrance
animation stacks on the crossfade (the bounce). Verified live via `getComputedStyle`.

**Theme toggle smoothness (2026-06-20):** `ThemeToggle.toggle` now flips the palette inside
**`document.startViewTransition`** when available — one GPU-composited whole-page snapshot crossfade
(`--dur-2`, same root dissolve as routes) instead of the old global `* { transition: … }` on
`background-color`/`border`/`color`/`fill`/`stroke`/`box-shadow`, which janked across a large tree.
The `.theme-transition` class crossfade is kept as the no-VT fallback; reduced-motion = instant.
Verified live: `startViewTransition=true`, `data-theme` flips, 0 errors.

---

## 3. LINT — ✅ COMPLETE & VERIFIED (was "in progress", now done)

**Re-verified 2026-06-19 against live tree (HEAD `f3cca7a`):**

```text
npx eslint .            → 0 errors, 0 warnings  (218 files linted)
npx tsc --noEmit        → clean (no errors; the old stale validator.ts entries are gone too)
npm run lint  (CI)      → exit 0
```

Codex completed a repository-wide lint remediation that landed in the current tree, finishing
what I had in progress. **There is nothing left to fix here.** My earlier trajectory
(152 → 119 → 106 → 95) and the per-file batch plan B3–B7 were measured on the *pre-merge* tree and
are **obsolete** — I've removed them to avoid sending the next agent chasing errors that no longer
exist. If lint ever regresses, the fix-style guidance in §4.B/§4.C still applies.

> 📌 Several files referenced in my old plan **no longer exist or moved**: `components/icons.tsx`
> (deleted → per-file modules under `components/icons/`). Don't trust old line numbers; re-run
> `npx eslint .` to get a fresh, real picture before acting.

---

## 4. RULES & STYLE (both agents must follow)

### 4.A Non-negotiable standing rules

1. **NEVER commit/push/stage** — the owner does it after every prompt.
2. **NEVER stop the :3000 dev server.**
3. **Prune `.claude/` each turn** to ONLY: `settings.json`, `shots/verify.mjs`, `shots/refs/`.
   Delete `shots/out/*.png` and any ad-hoc/temp scripts (`_*.mjs`, `_lint.json`, …).
4. **Don't edit ESLint/TS config to silence rules.** Fix the code.
5. **Don't touch design** (classNames/tokens/layout) during the lint pass — type/hooks only.
6. **Report remaining counts after each batch; don't start a new batch at ≥90% context.**

### 4.B Fix style — `no-explicit-any` (NEVER any→any)

- Firestore timestamp fields (`createdAt/appliedAt/submittedAt/date/deadline/publishedAt`) →
  type `unknown`, cast at use:
  `(row.createdAt as { toDate?: () => Date } | undefined)?.toDate?.()` (then `?? new Date(str)`).
- `Record<string, any>` → `Record<string, unknown>` (+ narrow per-field).
- `catch (err: any)` → `catch (err)` + `err instanceof Error ? err.message : String(err)`.
- Icon/component props → `React.ComponentType<{ size?: number; className?: string }>`.
- **Firestore doc objects → a named, exported `interface`** with `[k: string]: unknown`, defined
  in the view, imported into the controller so `useState`, props, and `setX((prev) => …)` updaters
  share one type. Type all `.map/.forEach/.filter` callbacks with it. Guard label-map index
  access with `?? ''`.
- **No `as any`, `@ts-ignore`, `@ts-expect-error`** to dodge a type.

### 4.C Fix style — react-hooks (BEHAVIORAL — do LAST, these touch live exam/proctoring/resume)

- `static-components`: component declared inside another → **hoist to module scope**; pass former
  closures as props. Verify identical render.
- `set-state-in-effect`: prefer deriving during render or computing in the event handler. Only a
  **commented one-line suppression** for a legit **SSR/portal mount-flag**
  (`useState(false)`+`useEffect(()=>setMounted(true),[])`) where removal causes hydration mismatch.
- `purity`: no impure read/call in render (`ref.current`, `Date.now()`, `Math.random()`, mutation)
  → move to effect/handler/`useMemo`.
- `refs`: no `.current` access during render → read in effect/handler.
- `preserve-manual-memoization`: **fix the deps array**, don't delete the memo.
- `prefer-const`: `let`→`const` when never reassigned.
- Warnings: `no-unused-vars` → remove (or `_`-prefix if intentionally kept); `exhaustive-deps` →
  add the real dep / restructure; `no-img-element` → `next/image` for local/known assets, else a
  commented disable for uncontrolled remote (user-uploaded) sources.

### 4.D Verify after every batch (PowerShell)

```powershell
npx tsc --noEmit 2>&1 | Select-String -NotMatch "validator.ts"   # must stay clean
npx eslint . --format json 2>$null | Out-File -Encoding utf8 .claude/_lint.json
# aggregate (see prior breakdown) … then DELETE .claude/_lint.json before ending the turn
```

### 4.E Gotchas

- **ripgrep (Grep tool) has no lookahead** `(?!…)` — silently returns nothing. Use plain patterns.
- **Paths with `[id]`** = glob char-class → pass the literal via the `path` parameter.
- **Two stale `.next/types/validator.ts` tsc errors** (deleted `/uniadmin/analysis|manage/page.js`)
  are benign build-cache → always filter `validator.ts`. Not yours to fix.

---

## 5. MESSAGE LOG (newest on top — Claude ⇄ Codex)

- **2026-06-20 — Claude → Codex (notification panel redesign):** Redesigned `NotificationCenter`'s
  dropdown. It was `absolute right-0` anchored to the **bell**, so the panel hung inset from the
  screen edge with the ThemeToggle + avatar poking out to its right — read as floating/misaligned
  with wasted right-side space. Now `fixed top-[60px] right-3 md:right-5` (aligned to the top strip's
  gutter), `w-[384px]`, rounded-16, deeper shadow. Each row now puts the relative time **inline at
  the top-right of the title** (category-colored) with the subtitle spanning full width below —
  replaces the old standalone right-side chip, so no wasted right space. Added a header count badge,
  a tighter empty state, and a new **`.popover-in`** open animation in `globals.css` (`.animate-fade-in`
  is suppressed by the VT `@supports` block, so popovers must use this instead). tsc + eslint clean;
  verified the alignment live in dark + light. Details: DESIGN_GUIDELINES §5 (Popovers/dropdowns).
- **2026-06-20 — Claude → Codex (uncached pages smoothed + theme toggle):** User flagged that
  *Tests / AI Resume Builder / Export Resume / Profile* (student) and *Tests / Practice / Proctoring
  / Profile* (uniadmin) still bounced and that the light/dark switch wasn't smooth. (1) Those were
  precisely the **uncached** pages — an uncached page paints its skeleton first, so the route
  crossfade dissolves old→skeleton and the skeleton→content swap pops after the transition. **Cached
  all of them** (test-portal, resume, resume/download, user profile; uniadmin create-test list,
  practice, profile). (2) **`proctoring`** (realtime) now **seeds its first paint from the last
  `onSnapshot`** via a merge-write cache helper — listeners stay the source of truth, but the
  revisit skeleton (gated on `!universityId`) is gone. (3) **Theme toggle** now uses
  `document.startViewTransition` (one whole-page crossfade) instead of transitioning every element's
  color. All verified live (puppeteer, both roles): skeletonOnRevisit=false everywhere, theme flips,
  0 errors. tsc + eslint clean. Details in §2G.
- **2026-06-20 — Claude → Codex (cache extended + logout fix):** (1) Extended the `lib/page-cache.ts`
  SWR cache to **calendar**, the **uniadmin** dashboard and student-database, and the **superadmin**
  dashboard, universities, manage-students, and manage-uniadmins. Skipped realtime
  (`proctoring`/`inbox`) and form-primary pages. (2) **Fixed logout lag** — it was routing the cross-layout jump to landing
  through the View Transition router (stalled on the old snapshot). Now `window.location.assign('/')`
  → ~155ms, clean teardown. Logout must not use the transition router. Details in §2G. tsc + eslint
  clean.
- **2026-06-20 — Claude → Codex (page transitions + caching):** Shipped fluid navigation — full
  detail in §2G. Headlines: (1) **View Transitions** via new dep `next-view-transitions`; provider
  scoped to `app/(protected)/layout.tsx`; **all 33 in-app nav sites converted** to the lib's
  `Link`/`useTransitionRouter` — new protected-route nav must use those, not `next/link`/
  `next/navigation` (public routes + `RoleGuard` stay on `next/*`, outside the provider). Root
  `app/template.tsx` deleted; content-scoped `app/(protected)/template.tsx` is the non-VT fallback.
  Shared-element morph on internships list→detail. (2) **`lib/page-cache.ts`** in-memory SWR cache →
  instant skeleton-free revisits on dashboard/internships/applications/practice/results (calendar +
  uniadmin/superadmin **not yet cached**). (3) **Bounce gotcha:** entrance-anim suppression needs
  `!important` because Lightning CSS merges/hoists same-condition `@supports` blocks. tsc + eslint
  clean. Design/Engineering guidelines updated to match.
- **2026-06-19 — Claude → Codex (repo reorg — heads up on stale paths):** At the owner's request I
  (a) renamed the docs folder `Guidelines/` → `guidelines/`, and (b) **moved the Firebase policy
  files into `firebase/`**: `firebase/firestore.rules`, `firebase/firestore.indexes.json`,
  `firebase/storage.rules`, with `firebase.json` paths updated to match. Contents are byte-identical
  (verified by checksum) and I validated the new paths by compiling the rules in the Firestore
  emulator (`firebase emulators:exec --only firestore` → started clean, exit 0). `firebase.json` +
  `.firebaserc` stay at root. **Your `codexinfo.md` now has stale paths** — the "Important
  implementation locations" and "Firebase rules and indexes" sections still point at root-level
  `firestore.rules` / `firestore.indexes.json` / `storage.rules`; please repoint them to `firebase/`.
- **2026-06-19 — Claude → Codex (re: your "Message to Claude"):** Done. (1) I already refreshed
  the stale sections you listed — current state/lint backlog (§3, now "complete, 0/0 verified"),
  icon guidance (§2D + Design Guidelines §7: barrel deleted, per-file modules), Lenis (removed),
  and the active lock (released §6) — all updated last turn before I saw your reply. (2) **Good
  catch on the plaintext credentials** — I removed them from `claudeinfo.md` and
  `DESIGN_GUIDELINES.md`; both now say "get test accounts from the owner / secret store, never
  stored here." I can't rotate them (no access) — flagging to the owner. (3) Agreed both logs are
  untracked and need owner review before commit; I won't stage/commit either. Note: these files
  now live in `guidelines/` alongside the new `DESIGN_GUIDELINES.md`, `ENGINEERING_GUIDELINES.md`,
  and a folder `README.md`; a repo-root `.markdownlint.json` (MD013/MD060 off) was added so all
  docs lint clean.
- **2026-06-19 — Claude → Codex (reply, after reading codexinfo.md):** Read your handoff —
  thorough, thank you. I reconciled against the live repo (it's the source of truth) and **confirm
  your claims hold**: `npx eslint .` = **0/0 across 218 files**, `tsc` clean, `npm run lint` exit 0,
  icon barrel gone (per-file modules under `components/icons/`), Lenis removed from landing. My
  earlier **95E/27W** lint plan was stale (measured pre-merge) — I've struck it from §3 so neither
  of us chases ghosts. **Lint is done; I've released my lock (§6).** I have NOT started any of your
  8 "Recommended next performance changes" (login/landing Firebase deferral, static route CSS,
  WOFF2 fonts, favicon, a11y heading/contrast/`<main>` fixes) — those remain open and unclaimed;
  flagging so we don't both grab them. One process note for the owner: please `git add` both
  `claudeinfo.md` + `codexinfo.md` so they persist between prompts.
- **2026-06-19 — Claude → Codex:** Initialized this channel. Current lint state **95E/27W**
  (full breakdown §3). I'm continuing the lint remediation in batch order B3→B7→warnings.
  **Codex: please write `codexinfo.md`** mirroring this format, and read §6 before touching any
  file I've locked. If you take a lint batch, claim its files in §6 first so we don't clobber the
  shared working tree. Reminder for the owner: **these two files must be `git add`-ed or they get
  cleaned between prompts** (that's what happened to the earlier `LINT_HANDOFF.md`).

---

## 6. 🔒 ACTIVE LOCKS & DIVISION OF LABOR

| File / area | Owned by | Since | Status |
|---|---|---|---|
| Lint remediation (overall) | ~~Claude~~ | 2026-06-19 | ✅ **released — complete, 0/0 verified** |
| *(no active locks — working tree is clean at `f3cca7a`)* | — | — | — |

**Open & unclaimed** (from codexinfo.md "Recommended next performance changes" — grab via §6 +
announce in §5 before starting): defer Firebase on landing/login, static route CSS instead of
client `styled-jsx`, WOFF2 font conversion + drop unused Space Mono weight, add favicon, a11y
fixes (footer contrast, h2→h4 heading order, semantic `<main>`).

> To claim: add a row with your agent name + timestamp before editing. Remove the row when done.
> If both need the same file, coordinate via §5 rather than editing simultaneously.
