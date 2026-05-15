# Starball — Product Requirements

High-level definition of the game. Implementation tasks and their status live in [`TASKS.md`](TASKS.md).

## 1. Goal

A polished single-page browser game that captures the feel of late-80s arcade physics puzzlers (Gravity Wars, Worms, Pocket Tanks). Tight gameplay loop, hand-look pixel art at a fixed logical resolution, chiptune SFX, instantly playable from any URL. Replay value through procedural maps, path-complexity scoring, and 2-player hot-seat.

## 2. Target user

The author and friends. A single player (or a couch pair) who enjoys physics-puzzle / arcade games. No accounts, no telemetry, no ads. Plays from a desktop browser; keyboard only.

## 3. Game elements

### 3.1 Canvas and HUD layout

- Logical canvas: **640 × 360**. Fixed **640 × 40 HUD band at the top** showing score, lives, level, angle and power readouts, mode/player name.
- **Playfield rect: 640 × 320** (below the HUD). All physics, walls, stars, goal, and launcher live here.
- Window: scales by the largest integer factor that fits the viewport (`min(host_w / 640, host_h / 360)`), letterboxed by CSS centering. HiDPI scaled by `devicePixelRatio`.

### 3.2 Palette and sprites

- **DawnBringer 32** palette, declared in `src/config.ts`.
- Sprites are **procedurally generated to HTMLCanvasElement** at first use (`src/sprites.ts`) — no PNG assets ship.
- Sprite reference sizes: asteroid 6 × 6, goal 24 × 24, brown dwarf 16 × 16, standard 24 × 24, blue giant 40 × 40, red giant 48 × 48, black hole 48 × 48 (16 px disc + 32 px capture-ring overlay).

### 3.3 Field

- Rectangular playfield 640 × 320. Four walls; bounce preserves 90 % of perpendicular speed, full tangential speed.
- One launcher and one goal, randomly placed per map within margins (launcher in left third, goal in right third), with `LAUNCHER_GOAL_MIN_SEP = 360 px`.
- 3–6 stars per map (capped). Difficulty changes star *types*, not counts (see §5).

### 3.4 Star types

Per-type parameters in `src/config.ts`. `G_GRAV = 8000` is the global Newtonian constant.

| Type        | Mass | Visible R | Softening ε | Force model                                | Notes                                                  |
| ----------- | ---: | --------: | ----------: | ------------------------------------------ | ------------------------------------------------------ |
| Brown dwarf |   60 |       6   |        3.0  | Plummer-softened Newtonian                 | weak pull, easy to ignore                              |
| Standard    |  200 |      10   |        5.0  | Plummer-softened Newtonian                 | the workhorse slingshot                                |
| Blue giant  |  300 |      16   |        8.0  | Newtonian + inverse-square repulsion within 2R (K = 3000) | radiation pressure makes close grazes deflect *less*   |
| Red giant   |  180 |      20   |       10.0  | Plummer-softened Newtonian                 | large radius, low density — gentle for its size        |
| Black hole  |    — |  8 / 16   |         —   | Capped pull: `a = aₘₐₓ · R_cap / max(r, R_cap)` with `aₘₐₓ = 5000` | bounded, falls off as 1/r (longer reach than gravity); entering the 16 px capture ring is instant death |

The `Visible R` column is the **base** radius. Blue giants and red giants are sized per-instance by mapgen with a uniform multiplier in `[1, 2]` — collision radius, Plummer softening, and the blue-giant repulsion zone all scale with the multiplier. Mass does **not** scale (only "size" varies), so a 2× red giant is the same gravitational well as a 1× one but presents a much larger target. Other star types are always at base radius.

Difficulty introduces star types progressively (see §5).

### 3.5 Asteroid, launcher, goal

- Asteroid: 6 × 6 sprite, 4-frame rotation. Trail rendered as a 24-frame fading particle line.
- Launcher: fixed turret sprite with an aim line in the current angle.
- Goal: 24 × 24 portal with a 4-frame pulse. Bounding circle radius 14 px → scored.

## 4. Mechanics

### 4.1 Controls

| Key            | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| ← / →          | Adjust launch angle (Shift = ×5 step)                          |
| ↑ / ↓ or + / − | Adjust power (Shift = ×5 step). Range 10–100 %.                |
| Space          | Fire (or select / continue)                                    |
| A              | Abort the active shot — no life lost                           |
| R              | Reset angle / power to defaults (only before fire)             |
| Esc            | Back to menu                                                   |

Browser auto-repeat handles key holds; no special input plumbing.

Training-only:

| Key | Action                                  |
| --- | --------------------------------------- |
| T   | Toggle trajectory preview               |
| G   | Toggle gravity-field heatmap overlay    |
| N   | New random map (random difficulty 1–8)  |
| L   | Cycle hand-authored maps                |

### 4.2 Physics

- Newtonian for non-black-hole stars: per-component `a = G·M·dx / (r² + ε²)^1.5`. The Plummer softening makes the force smoothly approach zero through the body center.
- Blue giant adds inverse-square repulsion within `2R`: `F_rep = +K·M / (r² · r)` per component, then accumulated against the Newtonian pull.
- Black holes use the capped-pull model in §3.4 — never singular.
- Integration: **Velocity Verlet** at base 120 Hz substep. **Adaptive substepping** within 3R / 1.5R of any star (2× / 4× factor). Render at 60 Hz.
- **Swept collision** between consecutive substep positions: line-segment vs circle for every star. Prevents tunneling through a body or a black-hole capture radius between samples.

### 4.3 Round end

Any one of:

1. **Scored**: asteroid enters the goal circle.
2. **Crashed**: asteroid–star distance ≤ R (swept-checked) or inside a black hole's capture radius.
3. **Exited**: asteroid leaves the playfield (walls bounce — this only fires if walls are disabled, currently not).
4. **Stopped**: `|v| < 5 px/s` and `|a| < 50 px/s²` for 1 s continuously.
5. **No progress**: 20 s elapsed with no decrease in minimum-distance-to-goal-so-far.
6. **Stuck-orbit timeout**: bounding-box of recent positions stays under threshold for the no-progress window.
7. **Hard timeout**: 35 s elapsed regardless.
8. **Player abort** (A): no goal, no life loss.

### 4.4 Scoring

Per scored shot:

```
score = round((base + curvature + grazing) × timeMultiplier)
```

- `base = 100` (any scored shot).
- `curvature` = `K_curv · Σ |dθ/dt|` over flight, with guards:
  - Frames where the asteroid bounced off a wall are excluded.
  - Per-star cap `C_STAR_MAX = 1500 / K_CURV`.
  - Time decay: curvature contribution from frames near star *s* decays linearly to zero after 1.5 s near that star.
  - Global cap `CURVATURE_GLOBAL_CAP = 5000`.
- `grazing` = `Σ K_GRAZE · max(0, 1 − d_min / (3R)) · M_star` for each star encountered.
- `timeMultiplier`: 1.0 inside the first 6 s; decays linearly to a floor of 0.1 over the next 14 s; floored at 0.1 from then on. Discourages "lucky" slow goals.
- Crashed / exited / stopped / no-progress / aborted → 0.

In-flight feedback:

- Per-star `+bonus` popup the first time the asteroid enters the 3R graze zone (with a short SFX). Suppressed if the asteroid crashes in the same shot.
- HUD shows the running curvature subtotal as `+N` when above threshold.
- Post-shot overlay: `BASE / CURVATURE / GRAZING / [TIME × m] / TOTAL`. On a successful goal the overlay holds until the player presses Space/Enter; on any other end condition it auto-dismisses after 1.5 s.

## 5. Modes

### 5.1 Play (single-player, procedural)

- Configurable lives (1 / 3 / 5 / unlimited) and difficulty (gentle / normal / hard) in settings.
- Each scored goal advances to a new procedurally generated map and **adds +1 life**, capped at **5** (unlimited mode is unchanged).
- Difficulty progression by introducing star types:
  - Level 1–2: standard + brown dwarf only.
  - Level 3–4: + red giant.
  - Level 5–6: + blue giant.
  - Level 7+: + black hole (always visibly marked with its capture ring).
  - Goal radius shrinks 14 → 10 px between L1 and L10, then holds.
- Loss of life on any non-scored end *except* player abort.
- Run ends when out of lives. Game over → high-score-entry if qualifies for that difficulty's top-10.

### 5.2 Battle (2-player, hot-seat)

- Two players alternate **3 shots per round** on a shared procedurally generated map; map regenerates each round; default **4 rounds** (configurable: 4 / 6 / 8 / 10 / 12).
- **Starting player alternates each round** so neither side has a persistent advantage.
- Scoring a goal consumes the rest of that player's shots for the round (no fishing for higher scores after success).
- Per-player totals tracked; highest total at end of N rounds wins.
- 2P scores are token-validated but not replay-validated (it's a couch game, leaderboard cheating is not the threat model).

### 5.3 Training (free play)

- No score, no life loss.
- N = new random map (random difficulty 1–8). L = cycle hand-authored maps. T = toggle trajectory preview (always available here, regardless of settings). G = toggle gravity-field heatmap.

## 6. Settings & persistence

Stored in `localStorage` (versioned schemas, corruption-safe defaults).

| Setting              | Values                                | Default        |
| -------------------- | ------------------------------------- | -------------- |
| Master / SFX / Music | 0–100 % (slider, 10 % steps)          | 70 / 70 / 50   |
| Lives                | 1 / 3 / 5 / unlimited                 | 3              |
| Difficulty           | gentle / normal / hard                | normal         |
| Trajectory preview   | off / first second                    | off            |
| Battle rounds        | 4 / 6 / 8 / 10 / 12                   | 4              |
| Angle / power step   | numeric                               | 1° / 1 %       |
| Shift multiplier     | numeric                               | 5              |
| Player 1 / 2 names   | string                                | P1 / P2        |

> Note: "full" trajectory preview is intentionally not selectable from the menu (leaderboard fairness — see §7). The setting type still accepts it for backward compatibility with stored values; Training has its own always-on `T` toggle.

High scores: per-mode tables in `localStorage`. Endless is partitioned by difficulty (3 separate top-10 tables); battle is a single table.

## 7. Shared high scores (online)

The backend (Hono + better-sqlite3, same container as the SPA) stores a shared leaderboard. When the API is reachable, the client submits there and reads from there; otherwise it falls back to the `localStorage` cache without breaking the game.

### 7.1 Anti-cheat

1. **Same-origin enforcement**: `Origin` / `Referer` checked on every write. Empty `ALLOWED_ORIGINS` means "any origin present" (fine when SPA + API share an origin); set it explicitly when fronting by a public hostname.
2. **Per-IP sliding-window rate limits** for both reads (`60/min` default) and writes (`10/min` default).
3. **Single-use session tokens**: `POST /api/session` → 24-char nanoid → consumed by `POST /api/scores`. TTL 900 s default.
4. **Replay validation** for Play mode: client submits the full per-shot transcript `{level, mapSeed, angleDeg, powerPct}`; server regenerates each map from the seed and re-runs the exact same Velocity-Verlet physics + scoring code the client ships. Submission rejected unless computed total matches the claim within tolerance. Battle is token-gated only.

### 7.2 Per-difficulty partitioning

Endless leaderboards are split by difficulty (gentle / normal / hard). Submission requires a valid `difficulty` in the body; the public read endpoint accepts `?difficulty=` to filter. Battle mode ignores difficulty (single table).

### 7.3 HighscoresScene UI

Endless defaults to the player's current difficulty; ←/→ switches between difficulties. Battle has a single table.

## 8. Help page

Reference sheet accessible from the main menu. Renders each star's actual in-game sprite (live from the sprite cache, pixel-identical to gameplay) alongside its name and a one-line description of its gravity behavior. Footer hint points users at the Training G key to see the gravity field interactively.

## 9. Settings & accessibility

- All gameplay is keyboard-only.
- Holding an arrow auto-repeats via the browser.
- Sound can be muted from the settings (master volume 0).
- No localization; English only.

## 10. Non-goals (v1)

- Mobile / touch input.
- Server-side accounts, OAuth, or per-user records (leaderboards are name-only by 3-letter initials).
- Online multiplayer.
- Hand-authored level packs beyond the 5 test maps shipped (used by procgen fallback and by Training's `L` cycle).
- Replay recording / playback (server only re-runs the physics; client doesn't visualize others' runs).
- Level editor.
- i18n.
