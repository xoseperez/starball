# Starball — Web

A gravity-puzzle arcade game in the browser. Launch an asteroid across a starfield, score in the goal on the opposite side. Stars exert gravitational pull on the asteroid, deflecting its path; the player aims and powers each shot to thread the field. The more the trajectory uses the gravity of the stars, the higher the score.

TypeScript + HTML5 Canvas 2D + Web Audio API. No external runtime libraries. The published bundle is ~50 KB (~21 KB gzipped) and runs from any static host.

## Develop

Requires Node 20+ and npm.

```sh
npm install
npm run dev        # vite at http://localhost:5173
npm test           # vitest (62 unit tests, all pure logic)
npm run build      # static bundle in ./dist
npm run preview    # serve the built bundle locally
```

## Deploy — Docker

A single container serves both the SPA bundle and the JSON API from the same Hono process — no separate reverse proxy, no service-to-service hop. The multi-stage `Dockerfile` builds the bundle in stage 1, compiles `better-sqlite3`'s native binding in stage 2, and copies only the artifacts into a clean `node:22-alpine` runtime stage (final image ~270 MB).

```sh
docker compose up -d --build
# starball is now at http://localhost:8080
```

Edit the host-side port (default `8080`) in `docker-compose.yml` if it clashes with something else on the box. The SQLite database lives in the named volume `starball-data`; tear down with `docker compose down -v` to wipe it.

### Behind Traefik

`docker-compose.yml` includes commented-out labels for putting `starball` behind an existing Traefik reverse proxy. To enable: comment out the `ports:` block, attach the service to your external `traefik` network, declare that network at the bottom of the file, and uncomment the `labels:` (adjust Host rule + cert resolver to your setup). The instructions are inline in the compose file.

Once Traefik exposes the game on a public hostname, set `ALLOWED_ORIGINS` to that exact origin (e.g. `https://starball.example.com`) so the same-origin check stays tight instead of falling back to the permissive "any Origin present" rule.

### Static-only

If you don't want shared scores, build the SPA bundle with `npm run build` and upload `./dist/` to any static host (GitHub Pages, Netlify, S3+CloudFront, a plain nginx dir). The Vite config sets `base: "./"` so the bundle works regardless of URL path. The client falls back to per-browser `localStorage` for high scores when the backend isn't reachable.

## Shared high scores

When the backend is reachable, Play and Battle modes submit scores to the server and the in-game high-scores table loads from there. When it isn't (no network, server stopped, static-only deploy), the client falls back to per-browser `localStorage` — so the game never breaks, it just stops being shared.

Anti-cheat is built in:

1. Same-origin enforcement via `Origin` / `Referer` check on every write.
2. Per-IP sliding-window rate limits for both reads and writes.
3. Single-use, short-TTL session tokens (POST `/api/session` → token → POST `/api/scores` consumes it).
4. **Replay validation** for Play mode: the client submits the full per-shot transcript (`{level, mapSeed, angleDeg, powerPct}` per shot); the server re-runs the *same* deterministic physics engine the client ships and rejects the submission unless the computed score matches the claim within tolerance. Battle mode is local-device 2-player so it's only token-gated, not replay-validated.

Backend behavior is tunable via env vars in `docker-compose.yml`:

| Variable                   | Default | Purpose                                                                |
| -------------------------- | ------- | ---------------------------------------------------------------------- |
| `ALLOWED_ORIGINS`          | *empty* | Comma-separated list. Empty = "require some Origin/Referer" (fine when SPA and API share an origin). |
| `RATE_LIMIT_WRITE_PER_MIN` | 10      | Max score submissions / sessions per IP per minute.                     |
| `RATE_LIMIT_READ_PER_MIN`  | 60      | Max GET /api/scores per IP per minute.                                  |
| `MAX_SCORE`                | 1000000 | Sanity ceiling — anything above is rejected outright.                   |
| `SESSION_TTL_SECONDS`      | 900     | How long a session token is valid for.                                  |

### Backend development

```sh
cd server
npm install
npm run dev         # tsx watch on :3000
npm run typecheck
```

The Vite dev server proxies `/api/*` to `http://localhost:3000`, so `npm run dev` at the repo root + `cd server && npm run dev` gives you a fully wired local stack without Docker.

## Controls

| Key             | Action                                                  |
| --------------- | ------------------------------------------------------- |
| ← / →           | Adjust launch angle (Shift = 5° steps)                  |
| ↑ / ↓ or + / −  | Adjust power (Shift = 5% steps)                         |
| Space           | Fire (or select / continue)                             |
| A               | Abort active shot (no life lost)                        |
| T               | Toggle trajectory preview (Training)                     |
| G               | Toggle gravity-field heatmap (Training)                  |
| N               | New random map (Training)                                |
| L               | Cycle hand-authored maps (Training)                      |
| R               | Reset angle / power                                     |
| Esc             | Back to menu                                            |

Holding an arrow key auto-repeats natively — no special handling needed.

## Modes

- **Play** — procedurally generated maps of increasing difficulty. Configurable lives. High scores shared via the backend when available, otherwise per browser.
- **Battle (2P)** — alternating shots on the same map, best total over an even number of rounds. The starting player flips each round so neither side has a persistent advantage.
- **Training** — free play, no scoring. `N` for a new random map, `L` to cycle hand-authored maps, `T` to toggle the trajectory preview, `G` to toggle a heatmap of the gravitational acceleration over the playfield.

## Star types

| Type        | Behavior                                                          |
| ----------- | ----------------------------------------------------------------- |
| Brown dwarf | small, weak gravity — minor obstacle                              |
| Standard    | medium gravity                                                    |
| Blue giant  | strong gravity at distance, slight repulsion within 2R (variable size 1×–2×) |
| Red giant   | large radius, low density (variable size 1×–2×)                   |
| Black hole  | capped non-Newtonian pull; instant destruction inside capture ring |

## Scoring

Each scored shot earns `round( (base + curvature + grazing) × time )`:

- **base** 100 for any successful goal.
- **curvature** bonus — sum of trajectory deflection (wall-bounce frames excluded, capped per-star, decaying over time near the same body, global cap).
- **grazing** bonus — close approach to each star, weighted by star mass.
- **time** multiplier — 1.0 inside the first 6 s, decays linearly to a floor of 0.1 over the next 14 s. Discourages "lucky" slow goals.

Crash, exit, stop, no-progress timeout, or aborted = 0.

The in-game **Help** screen has a second page (←/→) that shows the live formula with the current coefficient values.

## Project layout

```
src/
  main.ts             entry — wires App to the canvas element
  app.ts              main loop (requestAnimationFrame), input plumbing, scene stack
  config.ts           DawnBringer 32 palette, sizes, physics constants, default settings
  entities.ts         Asteroid / Star / Goal / Launcher / Map shapes + helpers
  physics.ts          Velocity Verlet, Plummer softening, swept collision, capped-pull BH
  scoring.ts          guarded curvature + grazing, in-flight assist events
  mapgen.ts           procgen with shot-sampler solvability check
  handmaps.ts         5 hand-authored maps (also used as procgen fallback)
  trajectory.ts       physics-driven preview line
  random.ts           mulberry32 seeded PRNG
  input.ts            AimState (turn-based angle + power)
  audio.ts            Web Audio API synthesised SFX (no audio files shipped)
  sprites.ts          procedurally-built sprites painted to HTMLCanvasElement at first use
  render.ts           HUD, text, trail, draw helpers
  persistence.ts      localStorage-backed settings + per-mode top-10 highscores
  api.ts              best-effort REST client for the shared scores backend
  settings_store.ts   in-memory settings singleton, loads from persistence at boot
  scenes/
    base.ts           Scene base class
    menu.ts
    play.ts           procgen, lives, high-score entry
    battle.ts         2P hot-seat with alternating starts and per-player colors
    sandbox.ts
    settings.ts
    highscores.ts
    initials.ts       3-letter arcade name entry on top-10 score
    help.ts           paged reference (star types + scoring formula)
tests/                vitest suites — physics / scoring / mapgen / input / persistence

server/
  src/
    index.ts          Hono app — JSON API + static SPA serving + SPA fallback
    db.ts             better-sqlite3 schema + helpers (scores, sessions)
    security.ts       Origin/Referer check, sliding-window rate limits, CORS
    replay.ts         imports ../../src/physics + ../../src/scoring; re-runs each
                      submitted shot transcript to verify the claimed score
    config.ts         env-var driven config

Dockerfile            multi-stage: builds SPA (stage 1), compiles native deps
                      (stage 2), runs in a clean node:22-alpine (stage 3)
```
