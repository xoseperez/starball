# Independent review — 004-touch-input, round 2

## Round 1 follow-up

| First-round point | What changed | Verdict |
|---|---|---|
| Recommendation: replan around the history guarantee, device rule, and scaling conflict (`review-response-1.md:89-93`). | The spec now states the main-pointer rule and stretch scaling; the plan makes the history spike a pre-implementation gate and says a failure stops work (`spec.md:38-39, 101-110`; `plan.md:6-8, 187-205`). | **Partially resolved.** The previous contradictions are settled in writing. The Phase 0 pass/fail condition still does not require the target tablets to classify as touch devices; see RQ-020 below. |
| `spec.md`: settle stretch vs integer scaling (`review-response-1.md:97`). | The spec records stretching as the intended rule and says the constitution, architecture, AGENTS, and WASM wording will be updated (`spec.md:104`). Phase 7 lists those changes (`plan.md:211-220`). | **Resolved** as a product decision, based on the user's explicit decision. The constitution amendment remains a required implementation task, not yet-completed evidence. |
| `spec.md`: make the PC rule realizable (`review-response-1.md:97`). | “Never on a PC” is now defined as “never when the browser reports a mouse/trackpad main pointer”; tablets without one may show touch controls (`spec.md:38-39, 135`). | **Resolved** as an observable requirement. The rule no longer promises identification of a computer's product category. |
| `spec.md`: do not relax RQ-005 if history behavior fails (`review-response-1.md:97`). | Failure on either target browser now stops implementation pending the user's decision (`spec.md:120, 149`; `plan.md:8, 202-205, 325`). | **Resolved** in the specification and plan. |
| `plan.md`: move history/device checks before implementation and make them decisive (`review-response-1.md:98`). | Phase 0 precedes implementation, tests system Back sequences and records media values on both tablets (`plan.md:187-205`; `tasks.md:5-12`). | **Partially resolved.** History failure is a hard stop, but the decision line in `tasks.md:12` only gates on page retention. It does not say to stop if Android Chrome or iPad Safari reports media values that make the target tablet classify as non-touch. |
| `plan.md`: strengthen RQ-001 handler coverage (`review-response-1.md:98`). | Phase 2 now requires a line-by-line handler audit and records it in the checklist (`plan.md:220-224`; `tasks.md:29-31`). | **Resolved.** This is independent of the test/table transcription. |
| `plan.md`: prove RQ-002 scene-state equivalence, not just emitted events (`review-response-1.md:98`). | The plan adds real-scene key-vs-touch comparisons and a recorded call-path check (`plan.md:28, 240-243, 282`; `tasks.md:47`). | **Partially resolved.** The test is materially stronger, but the Node scene path is not yet isolated from runtime side effects: `HighscoresScene` starts a fetch in its constructor (`src/scenes/highscores.ts:21-26`), settings can persist through a singleton, and scene transitions use asynchronous imports. The Phase 0 construction check does not itself make these test runs deterministic or pure. |
| `plan.md`: test RQ-004 scene confirmation rules (`review-response-1.md:98`). | `backConfirmRule()` is now a named pure API, tested across phases and compared with scene hooks (`plan.md:89-91, 220-224, 242-243`; `tasks.md:24, 47`). | **Resolved.** |
| `plan.md`: verify RQ-006 coarse flags and actual step deltas (`review-response-1.md:98`). | The repeat suite now checks coarse flags, and real-scene tests check configured Play/Battle and fixed Training deltas (`plan.md:240-243, 285`; `tasks.md:24, 47`). | **Resolved**, provided the Node tests pass without rendering or external services. |
| `plan.md`: require RQ-012 visual legibility evidence (`review-response-1.md:98`). | The checklist now has per-readout legibility rows, with unreadable text explicitly failing and requiring layout changes (`plan.md:291`; `tasks.md:73-78`). | **Resolved.** |
| `plan.md`: check pure-module transitive imports (`review-response-1.md:98`). | The source check follows imports transitively and includes `globalThis` in forbidden browser names (`plan.md:221-224, 295`). | **Resolved as a planned check.** Review the scanner's actual traversal and allowlist when implemented; a token scan alone is not proof of transitive purity. |
| `tasks.md`: require dated pass/fail evidence and remove the accepted RQ-005 failure fallback (`review-response-1.md:99`). | Phase 0 is now first; checklist cells require pass/fail/n/a plus dates, and no fallback failure is accepted (`tasks.md:5-12, 78`; `plan.md:325`). | **Resolved**, apart from the missing target-classification gate condition noted above. |
| Constitution: Scope bend (`review-response-1.md:36`). | The feature still explicitly expands touch support, and the spec lists removing the exclusion in Phase 7 (`spec.md:3, 101`; `tasks.md:66-75`). | **Resolved and justified.** The tablet-play goal is a feature-spec-backed scope expansion. This response records the decision as required by `.sdd/constitution.md:3`. |
| Constitution: Physics integrity (`review-response-1.md:37`). | No change: RQ-007 prohibits edits to shared physics/scoring/mapgen and server paths (`spec.md:117`; `plan.md:286`). | **Resolved / complies.** |
| Constitution: Assets and palette (`review-response-1.md:38`). | The procedural icon and DawnBringer 32 constraints remain (`plan.md:117`; `spec.md:107`). | **Resolved / complies.** |
| Constitution: integer scaling (`review-response-1.md:39`). | The user has decided the current stretch is the rule; the spec records that decision and Phase 7 updates the constitution/architecture/AGENTS documents (`spec.md:104`; `plan.md:215-220`). | **Resolved as a knowingly approved bend**, not an accidental implementation deviation. The doc update is still pending. |
| Constitution: tests must be pure logic only (`review-response-1.md:40`). | New scene-state tests are added, without rendering, to check real handlers (`plan.md:28, 240-243`). | **Partially resolved.** No DOM/canvas test is proposed, but the real scene classes have effects such as remote fetch and persistence. Ensure those tests run with isolated/injected dependencies and deterministic async handling, or test a pure action layer instead. |
| Constitution: stack, process, and unrelated scope (`review-response-1.md:40-41`). | Plan retains TypeScript ESM/Vitest and introduces no unrelated excluded feature (`plan.md:186-228`). | **Resolved / complies.** |
| RQ-001 was weak because its coverage table and test were co-authored (`review-response-1.md:76`). | Independent handler audit now required and recorded (`plan.md:224`; `tasks.md:30`). | **Resolved.** |
| RQ-002 was weak because a fake target only proved emitted events (`review-response-1.md:77`). | Real scene state comparisons plus call-path inspection added (`plan.md:240-243, 282`). | **Partially resolved** for the test-isolation and async reasons above. |
| RQ-004 was weak because tests only exercised a boolean (`review-response-1.md:78`). | Pure scene/phase rule plus scene-hook agreement tests added (`plan.md:89-91, 242-243`). | **Resolved.** |
| RQ-006 was weak because step counts did not prove coarse deltas (`review-response-1.md:79`). | Coarse flags and scene angle/power deltas added (`plan.md:240-243, 285`). | **Resolved.** |
| RQ-012 was weak because geometry did not prove legibility (`review-response-1.md:80`). | Manual per-readout legibility checks and a fail-and-redesign rule added (`plan.md:291`; `tasks.md:73-78`). | **Resolved.** |
| RQ-005 was uncovered because the former plan accepted a double-Back failure (`review-response-1.md:84`). | The fallback is removed; Phase 0 must pass on both browsers before implementation (`plan.md:8, 202-205, 317`; `tasks.md:5-12`). | **Partially resolved pending execution.** The plan is now decisive; no browser evidence exists yet, so implementation is not authorized by this review until the gate actually passes. |
| RQ-020 was uncovered because a media query cannot identify a PC product category (`review-response-1.md:85`). | The spec intentionally defines the behavior by the main pointer reported by the browser and documents tablet/trackpad consequences (`spec.md:38-39, 135`). | **Partially resolved.** The rule is now implementable, but Phase 0 must make target-device classification a pass condition, not merely record the values. The physical touchscreen-PC test is unavailable and is reasonably replaced by testing the defined query behavior. |

## Assumptions challenged

- **A pre-implementation browser spike can establish whether the History API guard is feasible on the two target browsers.** History-entry skipping, delayed-import activation, re-arming, and iPad edge-swipe behavior are **unverified and plausible**, not established by repository evidence. The plan tests same-URL entries, delayed transitions, reload, Esc/default prevention, double Back, and edge swipe (`plan.md:187-205`; `tasks.md:5-12`); the pass/fail policy says stop on any page exit (`plan.md:8, 202-205`). **Verdict: partially holds** until actual device results are recorded; the method is appropriately concrete and the history failure criterion is decisive.
- **Android delivers the tablet keyboard's Escape in a way that `preventDefault()` can keep inside the page.** This is **unverified and doubtful enough to require the spike**: the user's reported browser-minimizing behavior is the motivation, not evidence that the planned listener can intercept it. Phase 0 explicitly tests Escape with and without `preventDefault()` (`plan.md:193-200`), and any sequence that exits the page is a stop condition (`plan.md:202-205`).
- **The target tablets report `(pointer: coarse)` and `(hover: none)` when used as touch-first devices.** This is **unverified**; the classifier is explicitly defined by those features (`spec.md:38-39, 135`), and Phase 0 records them on Android and iPad (`plan.md:196-201`). No result is present yet, and the gate does not stop if either tablet fails the predicate. **Verdict: partially holds.**
- **The main-pointer rule provides the desired PC behavior without classifying computer product types.** The explicit rule and accepted consequences are coherent: a mouse/trackpad main pointer suppresses touch UI; a tablet PC used without one counts as touch (`spec.md:38-39`). Browser media values can be tested, and the implementation tests all four combinations (`plan.md:195-201, 295`). No touchscreen PC is available, but one is not needed to verify the observable contract. **Verdict: holds**, subject to confirming the two target tablets actually meet the touch predicate.
- **The existing stretched transform is the desired canvas rule and touch mapping can invert it.** `src/app.ts:69,99` currently sizes to native DPR and applies separate X/Y scales. The spec now chooses that behavior and states target-size assumptions (`spec.md:104, 106`); the plan applies `renderTransform()` to both rendering and hit-testing (`plan.md:3-8, 49-58`). This is no longer an accidental conflict, though the docs are not updated until Phase 7. **Verdict: holds as a documented, user-approved change.**
- **Touch controls can reuse `InputEvent` without duplicating game logic.** `Scene.handleEvent` is the current shared input path (`src/scenes/base.ts:4-10`), and the plan sends touch commands through dispatch into it and adds only focus hooks (`plan.md:3, 97-111, 240-243`). **Verdict: holds**, provided the planned call-path check and scene tests cover all relevant commands.
- **Real scene classes can be tested under Vitest's Node environment without crossing the pure-logic test boundary.** Scene import/construct is a planned Phase 0 check (`plan.md:202`; `tasks.md:11`), and tests do not call render (`plan.md:240-243`). But `HighscoresScene` calls `refreshRemote()` in its constructor (`src/scenes/highscores.ts:21-26`); Settings touches a singleton persistence store; and handlers can trigger async scene imports. **Verdict: partially holds.** The test concept is useful, but the plan needs an explicit isolation policy so test execution is deterministic and does not perform I/O.
- **The layout and HUD fit is calculable and then confirmable on device.** Layout rectangles, size/gap invariants, `MONO_ADVANCE`, and width-limited drawing are specified (`plan.md:117-140, 288-295`); device legibility failures require a layout change (`plan.md:291`). Real Canvas font metrics remain device/browser-dependent. **Verdict: partially holds**, with credible planned manual evidence.
- **The Fullscreen API path and gesture suppression work in both browsers.** Safari Fullscreen API support and whether gesture suppression blocks the listed browser actions are **unverified but plausible**; no repository evidence establishes either. The plan records API availability in Phase 0 and checks actual enter/exit and gestures on both tablets later (`plan.md:177, 201, 292, 299`; `tasks.md:10, 62`). **Verdict: partially holds** until those tests are run.

## Alternatives considered

- **Replace the browser history guard with a full-screen/PWA or install-only requirement.** That could change browser Back behavior, but it does not meet the stated in-browser delivery or protect users who open the site normally. The plan's guard is better if the Phase 0 spike passes.
- **Use named actions instead of synthesized key events.** Named actions would remove dependence on key spellings but require changing each existing scene handler. Reusing the current `InputEvent` is smaller and preserves the single game-logic path; the new handler audit and state comparison tests provide a reasonable safeguard.
- **Keep scene-level equivalence tests versus extract pure action functions.** Real scene tests provide stronger integration evidence, but risk violating the pure-logic boundary when they invoke persistence, network, audio, or async scene transitions. Prefer pure action functions if dependency isolation makes tests brittle; otherwise keep scene tests strictly side-effect-free through injected or mocked dependencies.

## Risks accepted

1. **The back guard may fail on one target browser despite the spike.** This is the highest impact browser risk: RQ-005 promises the page cannot be left from an active scene. Phase 0 and Phase 5's per-scene repeat are the right safeguards (`plan.md:187-205, 225-228`; `tasks.md:5-12, 57-59`), but results must be recorded before implementation.
2. **The target tablet could be classified as non-touch, or its reported media values could differ when a keyboard/mouse is attached.** The classifier and manual matrix are explicit (`spec.md:38-39`; `plan.md:195-201`), but the Phase 0 decision currently gates only on history behavior (`tasks.md:12`).
3. **Node scene tests could become nondeterministic or perform unwanted I/O.** `tests/touch-scenes.test.ts` exercises real classes and compares state (`plan.md:240-243`); Highscores construction initiates a remote fetch, while Settings accesses singleton persistence. Isolate these effects before relying on test output.
4. **Text may technically fit but be unreadable after compression.** The plan correctly relies on a per-readout visual check and redesign on failure (`plan.md:291, 313-321`); Battle's 116 px player boxes remain the tightest case (`plan.md:136-140`).
5. **The fullscreen and gesture behavior may vary across browser versions.** Phase 0 and the final checklist call for actual device checks (`plan.md:187-205, 299-321`); do not infer support merely from API property presence.
6. **Documentation and the constitution remain stale until Phase 7.** This is an intentional sequencing choice after an explicit user decision, but any implementation must not be considered complete before the listed edits (`plan.md:211-220`).

## Constitution check

- **Scope — knowingly bends it, with justification.** Touch input is currently excluded (`.sdd/constitution.md:39-50`); the feature spec explicitly justifies the scope change, and the tablet-play goal supports it. This response is the required decision record under `.sdd/constitution.md:3`.
- **Canvas scaling — knowingly bends it, with explicit user decision.** The constitution still says integer-factor scaling (`.sdd/constitution.md:18-20`), while the spec chooses the existing stretch and Phase 7 updates the constitution, architecture, and AGENTS references (`spec.md:104`; `plan.md:215-220`). The change is deliberate, not accidental; update the governing text as a required task.
- **Physics integrity — complies.** RQ-007 and the verification plan prohibit changes to shared physics/scoring/mapgen and replay validation (`spec.md:117`; `plan.md:286, 303-321`).
- **Assets and palette — complies.** The plan specifies procedural icons and palette aliases only (`spec.md:107`; `plan.md:117`), consistent with `.sdd/constitution.md:12-16`.
- **Tests — partially complies.** No DOM or canvas rendering tests are planned, and the pure-module suite fits `.sdd/constitution.md:27-30`. The real-scene tests in `plan.md:240-243` may invoke remote fetch and persistent singleton state; make those tests deterministic and side-effect-free or extract pure action logic.
- **Stack — complies.** TypeScript ESM, Vite, and Vitest remain unchanged (`.sdd/constitution.md:5-10`).
- **Process — complies.** No commit or generated artifact is specified to use emojis or bypass hooks (`.sdd/constitution.md:32-37`).
- **Other exclusions — complies.** No accounts, telemetry, online multiplayer, replay playback, editor, or i18n work is introduced (`.sdd/constitution.md:43-50`; `spec.md:23-32`).

## Verification gaps

- **Phase 0 classifier gate:** record values for each device, but `tasks.md:12` only makes the history sequences a go/no-go. Add a condition that Android Chrome and iPad Safari in the intended touch-first setup both satisfy `(pointer: coarse)` and `(hover: none)`. If not, stop for a user decision rather than proceeding with a tablet that receives no controls.
- **Node scene test isolation:** the Phase 0 import/construct check does not prove that the later state-equivalence suite is pure or deterministic. `HighscoresScene` starts a fetch during construction (`src/scenes/highscores.ts:21-26`). State how tests stub/avoid remote APIs, reset `SETTINGS`/persistence, and await any dynamic imports, or replace these integration tests with pure extracted action tests.
- **History evidence:** Phase 0's sequence list is strong, and the hard stop is decisive for page exit. Ensure each row records browser/version, starting scene/guard depth, event order, and resulting page/scene state in `tasks.md`; repeat the same cases against the wired app in Phase 5, since a scratch harness cannot prove application wiring.
- **Fullscreen evidence:** `document.fullscreenEnabled` presence is not equivalent to successful entry/exit. The plan does include actual toggle and exit checks on tablets; record unsupported separately from a failed supported API, as RQ-019 requires.
- **Pure dependency scan:** the planned transitive scan is credible if it resolves each static import and checks the full dependency closure, rather than only searching literal global names. Keep Node execution of pure suite as a second check.
- **The full build/test matrix is not evidence that browser-only features work.** This is appropriately supplemented by the checklist, and the plan explicitly requires every manual row to be dated and pass (`plan.md:303-321`).

## Requirements contract coverage

### Fully covered with credible planned evidence

- **RQ-001** — Layout coverage plus independent line-by-line handler audit and device checklist (`plan.md:220-224, 281`).
- **RQ-003** — Layout hit-testing tests and tablet checklist (`plan.md:283`).
- **RQ-004** — State-machine tests, pure per-phase rule tests, scene-hook comparison, and one checklist row per rule (`plan.md:284`).
- **RQ-006** — Repeat timing/coarse-flag tests and real-scene angle/power delta tests (`plan.md:285`).
- **RQ-007** — Shared-module diff check and replay-invariant tests (`plan.md:286`).
- **RQ-008** — Interleaved pointer-tracker test plus two-finger manual test (`plan.md:287`).
- **RQ-009** — Transform round trips, shared draw/hit-test layout, and edge taps (`plan.md:288`).
- **RQ-010** — Bounds, target-size, and gap checks across enumerated layout states (`plan.md:289`).
- **RQ-011** — Touch-mode state tests and tablet keyboard/touch checklist (`plan.md:290`).
- **RQ-012** — Geometry/readout-capacity tests plus per-readout device legibility evidence (`plan.md:291`).
- **RQ-013** — Manual gesture checklist is the appropriate evidence for browser-controlled zoom/scroll/callout behavior (`plan.md:292`).
- **RQ-014** — Orientation boundary test plus mid-scene device rotation (`plan.md:293`).
- **RQ-015** — Desktop and tablet keyboard regression pass with the Esc exception explicitly stated in the spec (`spec.md:128`; `plan.md:294`).
- **RQ-016** — Transitive pure-import check and Node test suite are appropriate for the WASM portability boundary, if the dependency scan is complete (`plan.md:295`).
- **RQ-017** — Explicit document diff audit (`plan.md:296`).
- **RQ-018** — Deterministic ABORT/FIRE rectangle non-overlap test (`plan.md:297`).
- **RQ-019** — Fullscreen entry, toggle exit, and system exit on both tablets; unsupported API can be recorded separately (`plan.md:177, 299`).

### Weakly covered

- **RQ-002** — Real scene-state comparison and call-path inspection materially improve the prior test (`plan.md:282`), but the scene suite's external/persistent side effects and async imports are not yet controlled. Specify test doubles/reset/await behavior before treating the test as reliable.
- **RQ-005** — The new Phase 0 gate and post-wiring manual test are appropriate and the history failure is a hard stop (`plan.md:202-205, 284`; `tasks.md:5-12`). However, results are not present, and Phase 0's decision line does not gate on target pointer classification. The requirement is not proven until the spike passes on both browsers.
- **RQ-020** — The four media-query combinations and “never active when non-touch” invariant test the declared rule (`plan.md:295`), and actual browser values are recorded. But the go/no-go condition does not require both target tablets to meet the touch predicate; without that, the feature can proceed while failing its central tablet use case.

### Not covered at all

- **None identified in the plan's requirement mapping.** RQ-005 and RQ-020 have planned evidence paths, but their gate remains incomplete as noted above.

Non-test evidence is appropriate for browser-owned Back, fullscreen, gesture, and actual text rendering behavior. The revised plan correctly makes manual results required rather than predictive. The important remaining distinction is that recording media values is not itself a pass condition for the two target tablets.

## Recommendation

**Most important open question:** Will both target tablets actually report `(pointer: coarse)` and `(hover: none)` in the intended use configuration? The plan gathers that evidence, but currently allows implementation to proceed without requiring it.

**Approve with edits.** The first-round substantive conflicts are mostly resolved, and the Phase 0 history gate is a meaningful improvement. Before implementation, make the target-device classifier outcome a hard Phase 0 decision, and specify how the Node scene tests isolate network, persistence, audio, and asynchronous scene transitions. Do not start implementation until Phase 0 passes on both browsers.

## Required updates for planner artifacts

- **`spec.md`:** none. The behavior and accepted scaling/device definitions are now explicit.
- **`plan.md`:** Clarify that RQ-002/RQ-006 real-scene tests must not invoke real network, persistent browser storage, rendering, or audio; specify stubs/resets and how async scene transitions are awaited. If that cannot stay within the pure-logic convention, use extracted pure action logic plus recorded call-path inspection instead.
- **`tasks.md`:** Strengthen Phase 0's decision item: continue only if (1) every RQ-005 sequence keeps the page on both target browsers and (2) both target tablets in their intended touch-first setup report `(pointer: coarse)` and `(hover: none)`. Otherwise stop and bring results to the user. Record browser/version, media values, sequence, and event order.
