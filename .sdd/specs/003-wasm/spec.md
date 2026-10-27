# Spec — 003-wasm

## Problem
Starball is TypeScript tied to two JavaScript hosts: the browser (game) and Node (leaderboard API + replay validator), shipped together as one Docker image. That shape does not fit the target home for the game, the self-hosted app portal (`alpheratz/webapps`), which serves only static builds, one subdomain per app, installed from GitHub release zips. It also leaves no path to a native desktop build without a rewrite.

## Goal
Rewrite Starball in Rust as a **static WebAssembly game**, published as a GitHub release that the app portal installs and serves at `starball.app.<domain>`:

- one Cargo workspace with a platform-independent **core** crate (physics, scoring, mapgen) and a **game** crate compiled to WASM;
- high scores and settings stored locally in the browser; no server, no shared online leaderboard;
- pushing a version tag builds `starball-web-X.Y.Z.zip` in GitHub Actions and attaches it to a GitHub release, which the portal updater picks up like the Craft apps;
- the code is structured so a native desktop build is possible later, proven by compiling it.

Success: the WASM game plays identically to today's version (minus online scores), including the keyboard and touch controls defined in `.sdd/specs/004-touch-input/spec.md`, runs in the portal with its default settings, and the TypeScript client, Node server and Docker setup are removed in a single swap once parity is reached.

## Non-goals
- The shared online leaderboard: the server, replay anti-cheat, session tokens, rate limiting and SQLite storage are removed, not ported.
- Migrating existing online scores from the SQLite database.
- Carrying browser data over from the TS version. The portal is a new origin, so there is nothing to carry over.
- Shipping or packaging a playable native desktop build (only proving it compiles).
- Gameplay changes: physics constants, scoring rules, map generation, scenes and controls stay as they are.
- A hybrid TS/Rust client during the transition. The TS game stays untouched until the swap, except for `004-touch-input`, which lands in the TS game first and becomes part of the parity baseline.
- Offline/service-worker support beyond what the portal already provides.
- Anything excluded by `.sdd/constitution.md` § Scope (accounts, telemetry, online multiplayer, replay playback, level editor, i18n). The portal's ca/en/es launcher descriptions are portal config, not game i18n.

## User-facing behavior
For players:

- Starball appears in the portal launcher with its own icon and opens at `starball.app.<domain>`. It can be installed to the home screen like the other portal apps.
- Same 640 × 360 logical canvas stretched to fill the window, scenes, modes, controls (keyboard per the README controls table, touch per `004-touch-input`), sprites and synthesized sounds as today.
- The high-score table and initials entry work locally: scores are saved in this browser only. Online-only UI (the "online" / "offline (local cache)" source label, "submitting…" / "shared online" states) goes away.

For the maintainer:

- `git tag vX.Y.Z && git push --tags` produces a GitHub release with `starball-web-X.Y.Z.zip`; the portal installs it within a day, or immediately via its updater.
- A one-time `[starball]` entry in the portal's `config/apps.toml` (in the infra repo) lists the game.

Rollout: build the Rust workspace alongside the TS code until every scene and mode reaches parity, then remove the TS client, Node server and Docker files in one change.

## Constraints
Non-negotiables from `.sdd/constitution.md`. Rules this feature **bends** must be recorded as explicit decisions in `review-response.md`, and the constitution updated at the swap.

Bent or retired by design:
- **Stack: "TypeScript ESM end-to-end", Vite, Vitest, Hono, better-sqlite3, tsx.** Replaced by Rust, Cargo and a WASM web build.
- **Tests: Vitest.** Replaced by `cargo test`. The *pure-logic* rule stays: no DOM or canvas rendering tests.
- **"Docker Compose is the only supported deployment recipe. One image, one container."** Replaced by a static bundle released on GitHub and served by the portal.
- **Physics integrity (server replay must run the same code).** Retired along with the server.
- **Scope:** "shared online leaderboard" moves into the does-not-ship list.

Kept as-is:
- **No binary assets in the repo.** `.wasm`, release zips and any generated PNG icons are build outputs, never committed. Sprites stay procedural, audio stays synthesized. The app icon is rendered to PNG (192 and 512 px) at build time from the procedural sprite code.
- **DawnBringer 32 palette, fixed 640 × 360 logical canvas stretched to fill the window on both axes, HiDPI support.** (Stretching replaced integer scaling in the TS game; see `004-touch-input` § Constraints.)
- **Process rules** (no `--no-verify`, no force-push, `git mv` for moves) are unchanged.

Portal constraints (from `alpheratz/webapps/nginx/default.conf.template` and `config/apps.toml`):
- Served from its own subdomain root by nginx with `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` and `Cache-Control: no-cache` by default. Everything must load from the game's own origin; no CDNs.
- Release asset is a zip with `index.html` at its root (or inside a single wrapping folder), found via an asset-name regex such as `starball-web-[0-9.]+\.zip`.
- The portal adds a web manifest when the app ships none; an icon is given by URL or by a path inside the site.

Native-readiness:
- Web-only APIs (canvas, Web Audio, `localStorage`, DOM keyboard and pointer events, the media queries that detect touch devices, the History API used for system Back) are isolated behind a platform layer so the core and game crates also compile for a native target.

## Requirements contract

| Requirement ID | Requirement statement | Verification method | Evidence artifact |
|---|---|---|---|
| RQ-001 | The game is Rust compiled to `wasm32-unknown-unknown` and ships as a static bundle: `index.html`, a JS loader and the `.wasm` module. After the swap, no TypeScript, Node server or Docker files remain. | Inspection — WASM build succeeds; repo listing after swap | Build log; `git ls-files` output after the swap |
| RQ-002 | Physics, scoring and mapgen live in a core crate with no platform, I/O or JS dependencies; the game crate depends on it. | Inspection — dependency graph | `cargo tree` output for the core and game crates |
| RQ-003 | The Rust core reproduces the current TS behavior for physics, scoring and mapgen. | Test — golden fixtures generated from the TS modules (fixed seeds, maps, shots) *before* they are removed; Rust tests assert matching output. The existing pure-logic suites (physics, scoring, mapgen, input, touch, persistence) are ported to `cargo test`. | Fixture files committed in the workspace; `cargo test` output |
| RQ-004 | Feature parity: every scene (menu, play/Endless, battle, sandbox, high scores, settings, help, initials entry) behaves as in the TS version, including keyboard controls, the touch controls of `004-touch-input`, sprites, synthesized audio, palette, 640 × 360 stretch-to-window scaling and HiDPI. High scores and initials entry work locally, and online-only UI is removed. | Manual — side-by-side parity checklist, one line per scene and feature, run against both builds before the swap; touch items run on Android Chrome and iPad Safari | `.sdd/specs/003-wasm/parity-checklist.md` with pass/fail per item |
| RQ-005 | Settings and high scores persist across reloads in `localStorage`, keeping today's rules: versioned schemas, top 10 per mode (and per difficulty for Endless), corrupt or missing data falls back to defaults without crashing, and an in-memory fallback when storage is unavailable. | Test — ported persistence tests against a storage abstraction (corrupt JSON, wrong version, missing storage, top-10 cut) | `cargo test` output |
| RQ-006 | The core and game crates compile for a native target (`x86_64-unknown-linux-gnu`) with web-specific code behind the platform layer. A playable native build is not required. | Inspection — native `cargo build` of the core and game crates, run in CI | CI job log |
| RQ-007 | Pushing a tag `vX.Y.Z` runs a GitHub Actions workflow that builds the bundle and attaches `starball-web-X.Y.Z.zip` to a GitHub release. The zip has `index.html` at its root, and its version matches the tag and the workspace version. The release notes state the gzipped `.wasm` size (no hard budget; the number keeps growth visible). No build output is committed. | Inspection — one real release run; zip listing; repo scan for binaries | Actions run URL; release page with size line; `unzip -l` output; `git ls-files` scan with no `.wasm`/`.zip`/`.png` |
| RQ-008 | The bundle runs unmodified in the portal with default settings (no `isolation` override, no `spa` flag): all resources same-origin, works under COOP `same-origin` + COEP `require-corp`, and ships 192 and 512 px PNG icons, rendered at build time from the procedural sprite code, used by the launcher and home-screen install. | Manual — serve the release zip with the portal's nginx headers locally, then on the real portal, in desktop Chrome and Firefox; check the browser console for blocked resources | Checklist entries in `parity-checklist.md` |
| RQ-009 | The portal lists Starball: a `[starball]` entry in `alpheratz/webapps/config/apps.toml` (name, ca/en/es descriptions, `repo = "xoseperez/starball"`, asset regex, icon) installs the latest release. | Manual — updater run installs it; launcher shows it; game loads at `starball.app.<domain>` | Diff in the infra repo; checklist entry in `parity-checklist.md` |
| RQ-010 | The swap updates the steering docs: `constitution.md` (stack, tests, deployment, physics-integrity rule retired, leaderboard out of scope), `architecture.md`, `conventions.md`, `AGENTS.md` (commands, structure) and `README.md` describe the Rust workspace and the portal release flow. | Inspection — review of the swap diff | Diff of those files in the swap change |

Rules:
- Every requirement must have a unique ID (`RQ-001`, `RQ-002`, ...).
- IDs are stable: once created, do not renumber.
- Verification method must be concrete and project-realistic; tests are optional.
- Evidence artifact must be inspectable by a reviewer (file path, log, report, or explicit manual procedure).

## Open questions
Deferred to the plan (no user decision needed beyond the requirements above):
- **Rendering, audio and input approach** (a cross-platform game crate vs. direct browser bindings behind a platform trait), as long as RQ-006 and RQ-008 hold. `require-corp` rules out anything fetched from a CDN at runtime.
- **Web build tooling** (wasm-bindgen + a bundler, or a Rust-native web build tool), including how the build-time icon render runs in CI.

Resolved:
- Load budget: no hard limit; size is reported per release (RQ-007).
- Icon: PNG rendered at build time from the sprite code (RQ-008).
