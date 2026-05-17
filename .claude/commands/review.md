---
description: Generate a plan review (human gate) for an existing feature plan
argument-hint: <feature-folder-name-or-number>
---

You are drafting `review.md` for `ai/specs/$ARGUMENTS/` (resolve a bare number like `003` by prefix-matching).

The review is the **human gate before code is written**. Its job is to surface assumptions, alternatives, and risks so the user can sign off (or push back) with full context.

1. Read `spec.md` and `plan.md` in that folder. Stop if either is missing.
2. Re-read `ai/constitution.md` for non-negotiables that may have been violated.
3. Write `review.md` using the template below. Be honest and specific — a review that says "looks good" is useless.

Template for `review.md`:

```markdown
# Review — <feature name>

## Assumptions challenged
List the load-bearing assumptions in `plan.md` and whether they hold up. If you cannot find evidence, say so.

## Alternatives considered
At least two alternative approaches and why the chosen plan beats them. If there is no real alternative, say "no meaningful alternative" rather than padding.

## Risks accepted
What can go wrong and why we are accepting it. Tie each risk to a specific section of the plan.

## Constitution check
For each non-negotiable in `ai/constitution.md`, note whether this plan complies or knowingly bends it.

## Recommendation
- [ ] Approve as-is
- [ ] Approve with edits (list them)
- [ ] Reject — needs replan
```

End by surfacing the most important risk or open question for the user to react to before they sign off.
