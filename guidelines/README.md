# Guidelines

Everything an agent (or human) needs to make changes to UniShip **without the original chat
context**. Start here.

## Read in this order

1. **`ENGINEERING_GUIDELINES.md`** — stack, architecture (controller/view split), Firebase
   layers, data-access patterns, TypeScript/ESLint conventions, performance budgets, verification
   commands, standing workflow rules, and gotchas.
2. **`DESIGN_GUIDELINES.md`** — the visual contract: color/spacing/radius/motion tokens,
   typography, component & layout patterns, the icon system, and the runtime design gotchas.
3. **`codexinfo.md`** and **`claudeinfo.md`** — the two agents' **living working logs**: current
   deployment state, the production performance audit + open recommendations, recent changes, and
   the cross-agent message log.

## Two kinds of file

- **Guidelines** (`ENGINEERING_GUIDELINES.md`, `DESIGN_GUIDELINES.md`) are the **stable
  contract** — conventions that change slowly. Update them when a convention genuinely changes,
  and keep them concise.
- **`*info.md` logs** are **living memory** that changes every session. Each agent writes only its
  own file (Codex → `codexinfo.md`, Claude → `claudeinfo.md`) unless the owner asks otherwise, and
  both read each other's at the start of a task.

When a log and a guideline disagree, **the repository is the source of truth** — verify against
the live code (`npx eslint .`, `npx tsc --noEmit`, read the file) before trusting either doc.

## Inter-agent protocol (summary)

- Read both `*info.md` files at the start of a task.
- Before editing a file, claim it in the log's locks/division-of-labor section and announce it in
  the message log so the other agent does not clobber the shared working tree.
- Post a dated update at the end of substantial work.
- Never copy secrets (keys, tokens, env values, the cron secret) into any of these files.

## ⚠️ Persistence

The owner's per-prompt routine **deletes untracked files**. For these guidelines and logs to
survive between sessions, the owner must keep them tracked in git (`git add guidelines/`). An
earlier untracked handoff file was wiped this way.
