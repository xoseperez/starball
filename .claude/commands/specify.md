---
description: Scaffold a new feature spec folder under specs/
argument-hint: <feature-slug>
---

You are starting a new feature called `$ARGUMENTS`.

1. Find the next available three-digit number `NNN` by listing existing folders under `ai/specs/`. Use the next sequential number after the highest one (e.g. if `001-`, `002-` exist, use `003`).
2. Create the folder `ai/specs/NNN-$ARGUMENTS/` and inside it create `spec.md` with the template below.
3. Populate the **Problem** / **Goal** / **Non-goals** / **Open questions** sections with whatever the user has already said in this conversation. Leave the rest as TODO bullets to fill in interactively with the user.

Template for `spec.md`:

```markdown
# Spec — NNN-$ARGUMENTS

## Problem
TODO — what is broken or missing today?

## Goal
TODO — what does success look like?

## Non-goals
- TODO

## User-facing behavior
TODO — describe the experience or API surface

## Constraints
TODO — performance, compatibility, security, etc. (cross-link to ai/constitution.md if applicable)

## Open questions
- TODO
```

After writing the file, ask the user the first open question and proceed conversationally until the spec is filled in. Do not generate `plan.md` yet — that is `/plan`'s job.
