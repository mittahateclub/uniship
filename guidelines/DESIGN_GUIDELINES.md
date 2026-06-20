# Design Guidelines

The visual contract for UniShip. Read this before changing any UI so new work matches the
existing ~40 views. This is a **stable reference** — it describes the agreed design language, not
work-in-progress. For what is currently being built, see `claudeinfo.md` / `codexinfo.md`.

## 1. Design philosophy

- **Linear.app-style.** Calm, dense, hairline-bordered, neutral surfaces, brand color used
  sparingly. Reference screenshots live in `.claude/shots/refs/` (`linear.png`, `te.png`,
  `arena.png`).
- **"Quiet admin."** No saturated buttons in lists, no decorative gimmicks. Status is shown with
  small dots + words, not loud filled pills. The owner has repeatedly rejected bright/cyan
  per-row buttons and hover-revealed floating icons as "doesn't look good."
- **Recomposition over restyling.** When redesigning a view, rebuild its layout to the patterns
  in §6 — do not just swap colors on the old structure. The owner explicitly wants per-view
  recomposition ("still looks like the old UI" is the failure mode).
- **Theme-reactive.** Everything must work in dark and light. Never hardcode hex in app code;
  use the tokens in §2. (The landing/login pages are the one exception — see §9.)

## 2. Color tokens (the contract)

All colors are CSS custom properties defined in `app/globals.css`, with a `[data-theme='light']`
override block. **Use the token names — they are the stable contract across all views. Never
hardcode hex in application code.**

### Surfaces

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg-canvas` | `#040505` | `#ECEDEF` | Outer app field (behind the panel) |
| `--bg-primary` | `#08090A` | `#FCFCFD` | Page panel (`.app-panel`) |
| `--bg-surface` | `#0F1011` | `#F4F5F6` | Cards, list panels |
| `--bg-elevated` | `#17181B` | `#FFFFFF` | Hover states, active pills, icon tiles |
| `--bg-input` | — | — | Form field backgrounds |

### Text

`--text-primary` → `--text-secondary` → `--text-tertiary` → `--text-faint` (decreasing emphasis).
Micro-labels and meta use `--text-faint`/`--text-tertiary`; body uses `--text-secondary`;
headings use `--text-primary`.

### Accent, border, status

- `--accent-orange` — **holds the brand cyan** (`#00A8E1` dark / `#0082BE` light). Misnamed for
  historical reasons; it is the single brand accent. Use sparingly (active nav, key CTAs, focus).
- `--accent-indigo` / `--accent-ink` — secondary accents (e.g. proctoring uses indigo as its
  distinct "live monitoring" accent).
- `--border-subtle` (hairline default) / `--border-active` (hover/focus border).
- `--status-success` / `--status-warning` / `--status-danger` — semantic states. Status color
  appears on a value **only when it signals something actionable** (Live > 0, Pending > 0,
  Flagged > 0); otherwise numbers stay `--text-primary`.

### Categorical (event-type) palette

Theme-aware tokens, each with a deeper light-mode variant: `--type-event` (steel blue; also
"info"/"shortlisted"/"upcoming"), `--type-internship` (green), `--type-hackathon` (cyan),
`--type-research` (amber), `--type-workshop` (magenta). Chips: `bg-[var(--type-X)]/12
text-[var(--type-X)]`; dots: `bg-[var(--type-X)]`. The `TYPE_CONFIG` maps in
dashboard/internships/calendar already reference these. **Do not reintroduce the old hex**
(`#4B8BBE`, `#00C16E`, `#00A8E1`, `#F1A82C`, `#E04DB0`).

## 3. Typography

- **Fonts:** Geist Variable WOFF2 (`--font-geist`) is the global sans. Space Mono WOFF2
  (`--font-space-mono`) is scoped to the protected application layout for monospace/numeric
  accents; public landing and login routes do not load it. Bricolage is not loaded.
- **Max weight 600 for UI text.** A mechanical sweep normalized `font-bold`→`font-semibold`,
  `font-extrabold`→`font-bold`. `font-bold` is intentionally reserved for: avatar initials,
  unread-conversation emphasis, badge counts, and the resume-document heading.
- **Uppercase micro-labels** use `tracking-[0.07em]` (not `tracking-wider`/`tracking-widest`) at
  `text-[10.5px]` and `--text-faint`.
- **Page header pattern** (student views): `pt-6 mb-6`, `h1` = `text-[20px] font-semibold
  tracking-[-0.02em]` + 13px tertiary sub. Landing-scale variant used in some shells:
  `text-[26px] font-semibold tracking-[-0.025em]`, `pt-8 mb-7`. Uniadmin pages standardize on
  `pt-8 mb-7`.

## 4. Radius family

One radius scale — match it exactly (the owner flagged a 10px-vs-full clash as an inconsistency):

| Element | Radius |
| --- | --- |
| Cards, panels, inputs | `rounded-[var(--radius)]` (**10px**) |
| Icon-glyph tiles | `rounded-[8px]` |
| Small buttons | `rounded-[8px]` |
| Modals | `rounded-[14px]` |
| Pills, chips, status, avatars | `rounded-full` |

Do **not** re-add sharp corners — the old radius-zeroing `@theme` block was removed; the Tailwind
radius scale is intentionally restored.

## 5. Motion

- Easing: `--ease` = `cubic-bezier(0.16, 1, 0.3, 1)`. Durations: `--dur-1..4` =
  150 / 300 / 600 / 900ms.
- **Never use `transition-all`.** Scope transitions to the properties that change
  (`transition-transform`, `transition-colors`, `transition-opacity`) so they stay on the GPU
  compositor. Toggles animate `translate-x`, not `left`.
- Respect `prefers-reduced-motion` (landing has a static fallback).

### Route transitions (View Transitions API)

The authenticated app cross-fades between pages with the **View Transitions API**, driven by the
`next-view-transitions` library (its `<ViewTransitions>` provider wraps `app/(protected)/layout.tsx`
only — landing/login are excluded).

- **All in-app navigation uses the library** so every route change cross-fades. In any
  protected-route component, import `Link` and `useTransitionRouter` from `next-view-transitions`,
  **not** `next/link` / `next/navigation`. (Public routes — landing, login — and `RoleGuard` stay on
  `next/*`; they live outside the provider and would throw otherwise.)
- The crossfade is whole-page (`::view-transition-old/new(root)`), but the shell is identical across
  pages so only the workspace content visibly dissolves. Tuned to the system `--ease`/`--dur-2`.
- **`app/(protected)/template.tsx`** wraps content in `.route-fade` as a **fallback enter for
  browsers without View Transitions only** (Firefox/Safari today). Do not add a root `template.tsx`
  (it animates the whole shell = flicker).
- **Shared-element morph (list → detail):** set `view-transition-name` on the clicked element in its
  `onClick` *just before* navigation (only one element named at a time, or you get a duplicate-name
  error), and give the destination element the same static name. Reference: internships card title →
  detail `<h1>`, name `internship-hero` (`::view-transition-group(internship-hero)`).
- **⚠️ Bounce gotcha:** per-view entrance animations (`.animate-fade-in`, `.animate-slide-up`,
  `.stagger-children`) and `.route-fade` are disabled on VT browsers via
  `@supports (view-transition-name: none) { … animation: none !important; }`. The `!important` is
  **required** — Tailwind v4's Lightning CSS merges same-condition `@supports` blocks and hoists them
  above the base rules, so without it the entrance animation stacks on the crossfade (a visible
  double "bounce"). Don't drop the `!important`.
- **Why the flagged pages used to "bounce":** an *uncached* page paints its **skeleton** first, so
  the crossfade dissolves old→skeleton and then the skeleton→content swap pops *after* the
  transition with no motion — that pop reads as a bounce. The fix is the page cache (Engineering
  Guidelines §4): a cached revisit paints content directly, so the crossfade is the only motion.
  Keep new data pages cached so they match the smooth ones.

### Theme toggle (light ↔ dark)

- `ThemeToggle` switches the palette inside **`document.startViewTransition`** when available — one
  GPU-composited crossfade of the whole-page snapshot (the same root dissolve routes use, `--dur-2`).
  Do **not** go back to transitioning every element's color: a global `* { transition: … }` on
  `background-color`/`border`/`color`/`fill`/`stroke`/`box-shadow` janks across a large tree.
- Fallback (browsers without View Transitions): the `.theme-transition` class adds that scoped color
  transition for ~380ms, with a forced reflow so it commits before the palette flips. Reduced-motion
  users get an instant switch (no transition either way).

### Popovers / dropdowns

- Open animation uses **`.popover-in`** (`@keyframes popoverIn`, `transform-origin: top right`) for
  top-anchored panels and **`.popover-in-br`** (origin bottom-right) for the bottom-right floating chat
  widgets — **not** `.animate-fade-in`, which is killed by the VT bounce-suppression `@supports` block.
  These are component-scoped (only run on user open, never on route nav) so they're exempt and animate on
  every browser; reduced-motion disables them.
- **Scrim behind every popover.** Floating panels (notification, both support chats) render a
  **`.popover-scrim`** sibling first (`fixed inset-0`, soft dark/﻿light dim, `z-40`, click closes) with the
  panel above it at `z-50`. Without it an opaque card floating over the page content reads as "pasted on"
  and looks off; the scrim makes it an intentional layer. Keep it lighter than the cmdk modal overlay —
  these are side panels, not centered dialogs.
- **⚠️ Lightning CSS strips a raw `backdrop-filter` from `globals.css`** (Tailwind v4 engine drops the
  declaration — confirmed via the compiled `cssRules`). Apply the blur with the **Tailwind
  `backdrop-blur-[3px]` utility on the element instead** (the engine keeps its own utility). `.popover-scrim`
  therefore carries only the dim/position; the blur lives in the className. The blur is what gives
  separation in **dark** mode — a dark dim over the near-black canvas is nearly invisible on its own.
- **Anchor floating panels to the chrome's right gutter, not to the trigger.** The notification panel is
  `fixed top-[60px] right-3 md:right-5` (matching the top strip's `px-3 md:px-5`), `w-[340px]`, so its right
  edge lines up with the avatar/screen edge. Anchoring it `absolute right-0` to the bell left the
  ThemeToggle + avatar poking out to its right — it read as floating/misaligned with wasted space. The
  outside-click handler still works because the `fixed` panel is a DOM descendant of the trigger's `ref`
  wrapper; the scrim also closes on click.

## 6. Component & layout patterns

- **App shell.** Linear-app frame: `--bg-canvas` outer field, transparent borderless sidebar
  (active item = `bg-[var(--bg-elevated)]` pill + accent edge), chromeless top strip with a
  `rounded-full` search pill, page content inside `.app-panel` (a rounded-14px bordered
  `--bg-primary` panel with an ambient radial at top).
- **Page width.** All user pages use `max-w-[1200px] mx-auto` so gutters stay consistent across
  navigation. Match this on any new page.
- **Stat strips.** Two accepted forms, do not invent a third:
  - **Boxed clickable grid** — only the dashboards (home overview, clickable nav cells, Live
    pulse). `grid grid-cols-2 lg:grid-cols-4`, each cell `p-5` with a faint uppercase micro-label
    and a right-pushed faint icon, a big `text-[27px] font-semibold tabular-nums
    tracking-[-0.03em]` number, and a faint note.
  - **Slim `StatBar`** (`components/StatBar.tsx`) — every other list/manage page. One compact
    bordered bar: `inline-flex rounded-[var(--radius)] border bg-surface overflow-hidden
    divide-x`, each segment `px-4 py-2.5` is a faint 14px icon, a 15px bold tabular value, and a
    12px faint label. Every item needs a leading icon. Segments can be clickable (`onClick`),
    `disabled`, and per-icon colored (`iconAccent`). Standard placement `className="mb-6"`.
- **Register lists.** One bordered panel with `border-b` rows + `hover:bg-[var(--bg-elevated)]`
  (not stacked `space-y` cards). Row right-cluster = a quiet status toggle (`● dot + label`),
  an outline ghost "Review"/action pill (`rounded-full`, never `btn-primary`), and a quiet
  `⋯` overflow menu. **Secondary actions go in the `⋯` menu, not hover-revealed icons.**
- **Chips.** `rounded-full`, tinted `bg-X/10 text-X`, no border.
- **Buttons.** Solid CTAs `btn-primary !rounded-full` (or `!rounded-[8px]` where it sits beside
  8px controls — keep a section internally consistent). Outline/ghost actions are bordered pills.
- **Modals.** Use the shared shell `components/Modal.tsx` (`Modal`, `ModalHeader`, `ModalBody`)
  for **all** popups so margins are identical. `Modal({open,onClose,size:'sm'|'md'|'lg'|'xl'})`
  portals to `document.body`, backdrop `bg-black/50 backdrop-blur-[6px]`, panel
  `rounded-[14px]`, closes on Escape/backdrop. `ModalHeader` = optional 9×9 `rounded-[8px]` icon
  tile + title/subtitle + optional `right` slot + X. `ModalBody` scrolls internally (`flush` for
  full-bleed divided lists).
- **List ↔ detail in one page.** The standard pattern (see `student-database` + `practice`): a
  `selectedId`/`mode` state swaps the list for an in-page detail view (`key={id}` forces a clean
  remount). Prefer this over navigating to a separate route + "view full profile" popup.
- **Skeletons.** `components/Skeleton.tsx` exports `Skeleton` and `ListSkeleton({rows, withStats,
  leadingChip})`. Data-heavy lists return `<ListSkeleton/>` (instant page frame) instead of a
  bare spinner. Reuse it on new list pages.

## 7. Icons

- **The shim was split (June 2026):** icons are now **per-file modules under `components/icons/`**
  (plus `components/icons/smooth.tsx`). The old `components/icons.tsx` barrel was **deleted** to
  remove a bundle bottleneck. **Do not reintroduce a barrel.** Add a new icon as its own module.
- Icons are **Phosphor** under lucide-compatible names. **Never import from `lucide-react`.**
- Default weight is **`fill`** (soft solid silhouettes); **`bold`** only for directional/technical
  glyphs (arrows, chevrons, check, x, plus, Code, Hash, Globe, Terminal, ExternalLink, AlignLeft,
  Type). No duotone, no thin strokes (the owner dislikes "hard lines").
- Active sidebar icons are tinted `--accent-orange`. Mute form section-header icons to
  `--text-tertiary` (not accent).

## 8. Critical gotchas (these cause real, hard-to-debug breakage)

- **`position:fixed` transform trap.** `.animate-fade-in` leaves a permanent `transform` on the
  page root, which makes it the containing block for `position:fixed` descendants. Result: fixed
  modals/toasts/dropdowns land mis-positioned and `inset-0` overlays only dim the panel.
  **Fix: render every fixed overlay through `createPortal(node, document.body)`** (guard with a
  `mounted` flag for SSR). `Modal.tsx` already does this — using it avoids the trap.
- **Hex-alpha concatenation breaks with CSS vars.** Template tints like `` `${color}15` `` are
  invalid when `color` is a `var(--x)` and silently drop the background. Use
  `color-mix(in srgb, ${color} 13%, transparent)`. Grep for `` }15` `` / `` }20` `` / `` }30` ``
  before swapping hex→token.
- **Overflow clipping.** Register-list panels use `overflow-hidden`, so dropdowns must be
  `position:fixed` (via portal), not `absolute`, or they get clipped.
- **Declare hooks before any early return.** A latent hooks-order bug existed where
  `useState`/`useEffect` sat after an `if (loading) return`. Keep all hooks above early returns.

## 9. Landing & login (scoped exception)

- The landing and login use their own `--l-*` scoped tokens in statically loaded route CSS:
  `app/landing.css` and `app/login/login.css`. Keeping these styles out of client-injected
  `styled-jsx` prevents layout shifts. Dark is `#08090A`, light is `#fcfcfd`, and the light accent
  is `#0082be`. **Literal hex is legitimate only in these route styles.** Login is a filled
  split-panel (a lone centered card reads "empty" — keep layouts filled).
- The landing is full-viewport hero, dual-CTA, capability meta line, an "My Applications" demo
  card with floating chips, and a role-track strip — **company names must stay fictional/generic**
  (real firm names were removed for legal reasons; do not re-add them).
- Above-fold landing content renders visible immediately. Apply `.reveal-block` only below the
  first viewport so Intersection Observer timing cannot delay LCP.
- **Lenis smooth-scroll was removed** for landing-bundle performance — do not re-add it.
- `ThemeToggle` always lives in the page's top chrome (glass nav / login chrome / protected top
  bar). There is no floating fixed toggle — the owner rejected bottom-right placement.

## 10. Verification

- For headless checks you need a test account per role (student, uniadmin, superadmin). **Do not
  store credentials in this repo** — get them from the project owner / team secret store. Never
  paste usable passwords into committed docs.
- Use the harness `.claude/shots/verify.mjs` (puppeteer-core + system Chrome). For authenticated
  pages use `waitUntil: 'domcontentloaded'` + a sleep, never `networkidle0` (Firebase keeps
  sockets open). Always verify both dark and light. A light-mode screenshot taken mid
  theme-transition can show a repaint artifact — trust the settled shot.
