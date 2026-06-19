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

- **Fonts:** Geist Variable (`--font-geist`) is the global sans. Space Mono (`--font-space-mono`)
  for monospace/numeric accents. Bricolage is loaded but unused — do not add it to new UI.
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

- The landing (`app/landing-page.tsx`) and login (`app/login/login.view.tsx`) use their own
  `--l-*` scoped tokens in `<style jsx>` blocks (dark `#08090A` / light `#fcfcfd`, accent
  `#0082be` in light). **Literal hex is legitimate only here.** Login is a filled split-panel
  (a lone centered card reads "empty" — keep layouts filled).
- The landing is full-viewport hero, dual-CTA, capability meta line, an "My Applications" demo
  card with floating chips, and a role-track strip — **company names must stay fictional/generic**
  (real firm names were removed for legal reasons; do not re-add them).
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
