# Independent review — 004-touch-input

## Assumptions challenged

- **The `(pointer: coarse)` and `(hover: none)` pair identifies touch devices without showing touch UI on PCs with touchscreens.** The spec defines the device from these media features (`spec.md` § User-facing behavior), and the plan makes them the gate for `TOUCH.device` and every new feature (`plan.md` § Approach). These features describe the primary input capabilities, not whether a device is a PC; a touch-first PC can satisfy both. Conversely, an iPad with a trackpad may stop satisfying them. **Verdict: fails** for the stronger promise that no PC browser ever shows touch UI; the observable media-query rule itself is implementable.

- **Reusing the renderer's current transform is the safe way to map touches.** This does correctly align drawing and hit-testing with today's code: `src/app.ts:69` sizes the canvas to the viewport and `src/app.ts:99` independently scales X and Y. But the plan explicitly carries that stretch into `renderTransform()`, while `.sdd/constitution.md:20` and `.sdd/architecture.md` § Fixed logical canvas require integer scaling. Correcting the renderer instead would alter current keyboard presentation, conflicting with RQ-015. Touch-target claims also depend on which transform is authoritative. **Verdict: partially holds** as a description of current behavior, but the spec and plan have not resolved the policy conflict.

- **A two-entry History API guard can guarantee that system Back never leaves an in-progress scene.** The state machine can be tested in pure logic, but the browser behavior that matters cannot. The plan itself notes Chrome may skip entries without a user gesture and offers a fallback that accepts a fast double Back leaving the page (`plan.md` § Back navigation and § Open questions). That fallback contradicts RQ-005. The scene transition can also follow asynchronous imports (for example `src/scenes/menu.ts:87`), so pushing after a scene change is not necessarily still within a browser user activation. **Verdict: fails as a guaranteed requirement; the implementation hypothesis remains unverified.**

- **The proposed HUD and target geometry fit the target devices.** The plan gives concrete layout coordinates and adds a manual visual pass. However, the proposed `MONO_ADVANCE` is only a font-width estimate, and `drawText` currently has no `maxWidth` option (`src/render.ts:44-59`). Battle also narrows player boxes to 116 px. Actual browser font metrics and the final text-compression behavior are therefore unknown. **Verdict: partially holds** pending the specified device pass, especially for Battle names and the narrow landscape viewport.

- **The existing scene handlers are a reliable source of touch semantics.** This is a sound direction: keyboard actions already converge in `Scene.handleEvent` (`src/scenes/base.ts:4-10`), and the inspected handlers contain the phase-specific behavior the layouts need (`src/scenes/play.ts:68-95`, `src/scenes/battle.ts:76-95`, `src/scenes/sandbox.ts:42-75`, and the other scene handlers). The `REQUIRED_ACTIONS` table is nevertheless manually transcribed, so its coverage test can prove only that layouts cover the table—not that the table is complete. **Verdict: partially holds**; retain the explicit reviewer comparison against the real handlers.

- **Pure modules plus a source scan are enough to protect the future WASM port.** Keeping geometry, layouts, repeat, pointer state, mode, and back state independent of browser APIs is credible and fits `.sdd/specs/003-wasm/spec.md:30,45,52`. A token scan is a useful guard, but cannot by itself prove purity if browser access is hidden behind aliases or transitive imports. **Verdict: partially holds**; also inspect the dependency graph and keep the pure tests importing the public pure modules under Node.

- **Fullscreen, Escape, history, and gesture behavior will work on both named tablets.** No repository source establishes whether the target Safari version supports element fullscreen, how iPadOS reports primary/any pointer with a trackpad, or exactly how either browser delivers Escape and edge-swipe Back. The plan correctly identifies a device spike and manual checklist, but those are evidence to gather, not facts already established. **Verdict: unknown / partially holds** until tested on the actual Android Chrome and iPad Safari targets.

## Alternatives considered

- **Map touch to named game actions instead of synthesizing existing `InputEvent` key names.** Named actions would decouple controls from keyboard spellings and make requirement coverage clearer, but would require changing the shared input contract and every scene handler. The selected key-event approach is smaller and keeps one existing game-logic path. Keep it, but explicitly test the command-to-key mapping and check the coverage table against each handler.
- **Use DOM buttons over the canvas instead of drawing canvas controls.** DOM controls would offer native focus and accessibility semantics and make browser-sized hit areas easier to express. They would also require a second coordinate/layout system, complicate the one-layout drawing/hit-testing invariant, and would not port as directly to the Rust canvas client. Canvas controls are the better fit for this game's current UI and WASM parity goal, provided the manual device checks remain a release gate.
- **Correct the renderer to the documented integer-factor letterboxed transform before adding touch.** This would restore the constitution/architecture description and simplify a shared transform, but it changes existing keyboard presentation and may invalidate the claimed CSS touch-target sizes at 1024 × 768. Do not silently choose either behavior: resolve the scaling rule and RQ-015 together before implementation.

## Risks accepted

1. **System Back may still leave the page or lose the current run.** The History API and gesture timing are browser-controlled, and the proposed fallback explicitly permits an RQ-005 failure. The Phase 5 spike and real-device pass must be gating evidence, not optional tuning.
2. **The device classifier may violate the PC-only guarantee or disable touch on a target iPad.** Media queries identify pointer capabilities rather than device category; this affects the core RQ-020 promise and every UI/browser gate.
3. **The transform decision can break either the documented canvas rule, keyboard parity, or target sizing.** `plan.md` § Approach preserves the stretch in `src/app.ts:99`; the constitution and architecture prescribe integer scaling; RQ-010/RQ-015 then constrain the available change.
4. **Gameplay text may be clipped or too compressed to read.** `plan.md` § Gameplay HUD relies on readout boxes and `MONO_ADVANCE`; Battle's player boxes shrink to 116 px, and the actual Canvas font differs by browser. Check the longest values on both tablets and record legibility, not only geometric non-overlap.
5. **The keymap coverage test can pass with an incomplete transcription.** `REQUIRED_ACTIONS` and the test are planned together in `plan.md` Phase 2; retain the independent comparison with the handlers and record it.
6. **The Fullscreen toggle may be absent or fail to enter/exit fullscreen on iPad Safari.** `plan.md` § DOM and app wiring uses standard and WebKit-prefixed methods, but actual availability and exit behavior are platform-specific.

## Constitution check

- **Scope — knowingly bends it, justified.** Touch input is currently excluded by `.sdd/constitution.md:43`; the spec is an explicit feature expansion and Phase 7 removes the exclusion from both the constitution and `AGENTS.md`. This review response is the required decision record under `.sdd/constitution.md:3`. The expansion is justified by the stated tablet-play goal.
- **Physics integrity — complies.** The plan leaves physics, scoring, map generation, and server replay validation untouched; RQ-007 also requires an empty diff for those paths and existing replay tests to pass.
- **Assets and palette — complies.** The plan uses procedural icons and palette aliases from `src/config.ts`, with no binary assets.
- **Fixed canvas and integer scaling — unapproved violation; replan.** The plan follows the existing non-uniform stretch (`src/app.ts:69,99`) despite `.sdd/constitution.md:20` and `.sdd/architecture.md` § Fixed logical canvas. Merely noting documentation drift in `plan.md` § Open questions is not an approved exception, and correcting it may conflict with RQ-015 and RQ-010.
- **Tests — complies.** Planned automated tests are pure logic; browser and canvas behavior is assigned to manual device checks, consistent with the no-DOM/no-canvas-test rule.
- **Stack — complies.** The plan uses TypeScript ESM, Vite, and Vitest, with no stack change.
- **Process — complies as planned.** No generated documentation or code is planned to use emoji; the procedural icon paths avoid relying on glyph availability.
- **Other scope exclusions — complies.** The plan does not add accounts, telemetry, online multiplayer, replay playback, a level editor, or i18n.

## Verification gaps

- The Phase 5 browser spike is described as something that can run in parallel with Phase 1, but the task list places it in Phase 5 after the first tablet implementation pass. Make it an explicit pre-implementation gate: if it cannot meet RQ-005, stop and resolve the requirement rather than accept page exit.
- The spike must record actual results separately for Android Chrome and iPad Safari: history entries skipped or retained, Back/edge-swipe event ordering, Escape delivery and `preventDefault()` effect, behavior on a second Back during `QUIT?`, and whether re-arming after a scene transition works. These claims are browser-controlled and are not established by pure state-machine tests.
- Pointer classification must be recorded for the iPad with and without a trackpad and for a touchscreen PC. “Optional if available” does not establish RQ-020's categorical PC guarantee; the classification policy itself needs to be resolved first.
- The planned source scan should also verify imports transitively stay within pure touch siblings and `src/config.ts`; checking only a list of global-name strings can miss indirect browser dependencies.
- The back-state tests should cover the actual scene/phase confirmation mapping, not only `BackConfirm.request(needsConfirm)`. Specifically verify Play's post-shot/game-over transition, Battle's match-end transition, and Initials' editing/confirmation/done states.
- The repeat tests should assert emitted `shift` values and resulting fine/coarse deltas using the configured Play/Battle settings and Training's fixed 1/5 steps; a schedule/count test alone does not prove the aiming contract.
- `MONO_ADVANCE` tests cannot prove actual browser font rendering or readability. Keep the two-tablet visual check, include the longest values named in RQ-012, and record any compressed readout as legible or not.
- The proposed checklist is the right verification form for gestures, fullscreen, portrait rotation, and keyboard regression. It must include explicit pass/fail results for each device and for PC Chrome/Firefox; the plan is not evidence that these behaviors already work.

## Requirements contract coverage

### Fully covered with credible planned evidence

- **RQ-003** — Layout hit-testing tests plus tablet checklist cover the described direct-touch interactions.
- **RQ-007** — Shared-module diff inspection and unchanged replay-invariant tests are appropriate for the no-physics/server-change requirement.
- **RQ-008** — Interleaved pointer-tracker tests and the hold-plus/tap-FIRE manual check cover pointer independence.
- **RQ-009** — The round-trip cases, shared layout for rendering and hit-testing, and edge taps on devices are an appropriate combination.
- **RQ-010** — Testing every named layout state for bounds, dimensions, and gaps is measurable and credible, subject to resolving the transform conflict above.
- **RQ-011** — The state-switch tests and tablet keyboard/touch manual pass cover the touch-mode lifecycle.
- **RQ-013** — Browser gesture behavior cannot be credibly tested in the pure suite; the specified gesture checklist on both target browsers is appropriate.
- **RQ-014** — Pure portrait-boundary tests plus mid-scene rotation on device are appropriate.
- **RQ-015** — The planned keyboard pass on desktop and a tablet with a keyboard is appropriate for this UI/input change, provided it covers every existing scene and phase.
- **RQ-016** — A pure-module source/import check plus Node-based tests is suitable for the WASM boundary, with the transitive-import caveat above.
- **RQ-017** — Inspecting the listed documentation diff is the appropriate verification.
- **RQ-018** — A deterministic rectangle non-overlap assertion is a direct and sufficient check.
- **RQ-019** — Fullscreen is browser- and activation-dependent; the specified enter/exit/system-Back device procedure is appropriate. Record “unavailable” distinctly from a failed toggle.

### Weakly covered

- **RQ-001** — The test proves the layouts cover `REQUIRED_ACTIONS`, but both the table and test are planned together. It can miss an omitted keyboard action or phase unless a separate review compares it with every `handleEvent` body. Keep that inspection as a recorded evidence item, not an informal expectation.
- **RQ-002** — A recording fake proves `dispatch()` emits the expected key and shift values, but does not prove the promised same scene-state result. Inspection that `app.ts` routes both paths to the same `handleEvent` is strong evidence; add a focused test or make that call-path inspection an explicit verification item.
- **RQ-004** — The state-machine tests exercise a boolean `needsConfirm`, but do not prove the scene hooks return the right value in the specified phases. Add explicit checks for the Play, Battle, and Initials phase rules, or make these cases checklist items with results.
- **RQ-006** — The listed timing boundaries test the repeat schedule, but the mapping from scheduled coarse steps to configured angle/power changes is not explicitly verified. Assert the emitted coarse flag and resulting deltas, including Training's fixed values.
- **RQ-012** — Geometry tests establish box non-overlap, but `MONO_ADVANCE` is an estimate and the planned manual check must also establish that actual browser-rendered, width-compressed text remains readable. Treat the visual result as a required artifact.

### Not covered as currently specified

- **RQ-005** — The state-machine test cannot prove browser history/edge-swipe behavior, and the plan's stated fallback knowingly allows a fast double Back to leave the page. That fails the requirement that Back never leaves the page away from the menu. The browser spike and manual passes are appropriate methods, but the acceptance criteria must not permit this failure.
- **RQ-020** — The test verifies four media-query combinations and gates features on the classifier, but that cannot prove “no touch UI on any PC.” A PC whose primary pointer is coarse and cannot hover is indistinguishable from a touch tablet using only those two features. Resolve the product definition or detection policy; the current test cannot establish the stated guarantee.

Non-test verification is appropriate for browser-owned gestures, Back delivery, fullscreen, and actual device rendering. The problem is not the use of manual checks; it is treating an unresolved browser failure or an unobservable device-category guarantee as covered.

## Recommendation

**Most important open question:** Can the feature meet RQ-005's “never leaves the page except from the main menu” promise on both target browsers? The plan currently permits a failure mode that directly violates it.

**Reject — needs replan.** Resolve the scaling/keyboard compatibility conflict and the PC-touchscreen classification contradiction in the spec, and make the History API spike a pre-implementation gate with no acceptance of an RQ-005 failure. Then update the requirement coverage and tests/manual evidence as identified above.

## Required updates for planner artifacts

- **`spec.md`:** Resolve the conflict between integer-factor scaling in the constitution and the current stretched renderer, including the impact on keyboard parity and the stated 28 × 24 logical touch-target sizing. Reconcile RQ-020's categorical PC guarantee with a detector based on pointer media features, or define a realizable observable rule. Keep RQ-005's guarantee explicit and do not permit the current fallback that allows leaving the page.
- **`plan.md`:** Move the browser-history/device-classification spike ahead of implementation as a gate; specify what happens if either target browser fails RQ-005. Define how the chosen scale and classifier will be verified. Strengthen RQ-001/002/004/006/012 verification as noted above, and make manual device results mandatory evidence rather than a forecast.
- **`tasks.md`:** Move the history spike from Phase 5 to a pre-implementation task, add explicit record-and-decision tasks for pointer classification and scaling, add test/checklist tasks for the weak requirements, and remove the fallback task that accepts an RQ-005 failure.
