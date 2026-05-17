---
description: Draft an implementation plan for an existing feature spec
argument-hint: <feature-folder-name-or-number>
---

You are drafting `plan.md` for the feature at `ai/specs/$ARGUMENTS/` (resolve a bare number like `003` to the matching folder by prefix-matching).

1. Read the feature's `spec.md` end-to-end. If it is incomplete, stop and ask the user to finish `/specify` first.
2. Skim the relevant code (`src/`, `server/`, `tests/`) to ground the plan in the actual codebase. Cross-reference `ai/architecture.md` and `ai/constitution.md`.
3. Write `plan.md` in the same folder, using the template below.
4. Do **not** write code or run commands beyond read-only investigation. The plan is the deliverable here.

Template for `plan.md`:

```markdown
# Plan — <feature name>

## Approach
One or two paragraphs framing the design choice.

## Target shape
Trees, schemas, or signatures showing the end state.

## Phases
1. Phase 1 — <name>
   - Concrete steps with file paths.
2. Phase 2 — <name>
   - ...

## Sequencing
Why the phases run in this order; any dependencies between them.

## Verification
- Commands to run (tests, typecheck, lint)
- Manual checks if UI/UX is involved

## Open questions
- TODO
```

End by asking the user to review the plan before invoking `/review` or proceeding to implementation.
