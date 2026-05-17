I'll research current best practices for organizing AI-assisted coding projects. Let me search for what's emerging in this space.Good initial set. Let me dig deeper into a couple of specific patterns: the spec-driven layout convention and how people handle the "uncommitted reference materials" problem.Excellent. Now let me check the "uncommitted reference materials" question — how people handle external repos and scratchpads they want available to the agent but not in git.I have enough to give you a solid, opinionated synthesis. Let me also pull the Addy Osmani piece since it has a particularly clean framework.

I have enough material now. Given your style preferences (concise, direct, markdown-friendly), I'll write this as a structured note rather than a long-form essay.

---

# Repository structure for AI-assisted projects

A few consistent patterns have emerged across the recent literature (GitHub's 2,500-repo analysis, SpecKit, Kiro/cc-sdd, the Claude Code spec workflows). Below is a synthesis, mapped onto the items you already use.

## The four layers every AI-friendly repo has

Most mature setups split the repo into four conceptual layers. Yours already does — but they're worth naming explicitly because each has different rules around commit/visibility/scope.

1. **Steering layer** — the always-loaded context. Stable, slow-changing, project-wide.
2. **Spec layer** — per-feature artifacts: PRDs, design docs, plans, task lists.
3. **Code layer** — the actual implementation.
4. **Scratchpad layer** — reference material, external repos, exploration notes. Local-only.

Your `.resources` is the scratchpad layer. Your `docs/` mixes layers 1 and 2, which is the main thing worth disentangling.

## The steering layer

This is what gets loaded into the agent's context at the start of every session. GitHub's analysis of over 2,500 repositories identified six core areas that effective specification files must address: commands with flags, testing expectations, project structure, code style with examples, git workflow, and explicit boundaries.

Typical layout:

```
CLAUDE.md           # or AGENTS.md — entry point, loaded every session
docs/
  architecture.md   # how the system fits together, stable
  conventions.md    # coding standards with concrete examples
  constitution.md   # non-negotiables: tech stack, testing rules, what NEVER to do
```

The pattern that's winning: teams create a concise top-level CLAUDE.md that indexes into deeper specification files rather than containing everything itself. A common pattern uses a small CLAUDE.md that references separate markdown files covering project architecture, models, build sequence, test hierarchy, and test scenarios. The top-level functions as a map; Claude Code reaches into subdirectories as needed.

Keep CLAUDE.md short (hub) and link out (spokes). Bloating it costs context every turn.

On `AGENTS.md` vs `CLAUDE.md`: AGENTS.md is the emerging cross-vendor standard (Cursor, Codex, Aider, etc. read it). Claude Code reads CLAUDE.md natively but will follow an AGENTS.md if pointed at it. If you want one file that works across tools, use AGENTS.md and add a one-line CLAUDE.md that says "see AGENTS.md".

## The spec layer (PRDs, Plans, Plan Reviews)

This is where your PRDs/Plans/Reviews live, and where the biggest convergence has happened in 2025–2026. The dominant pattern is **one folder per feature**, numbered, self-contained:

```
specs/
  001-lorawan-gateway-provisioning/
    spec.md          # PRD — what we're building, for whom, why
    plan.md          # how — architecture, file layout, sequencing
    tasks.md         # ordered, testable steps
    research.md      # findings from due-diligence phase
    review.md        # your "plan review" artifact
    contracts/       # OpenAPI schemas, JSON schemas, type defs
  002-edge-ai-inference-pipeline/
    ...
```

This is the [SpecKit](https://github.com/github/spec-kit) layout (also used by Kiro, cc-sdd, Pimzino's spec-workflow). The reason it works: each feature gets its own folder under specs/. This structure makes every feature self-contained and traceable, and each document feeds the next. The plan references the spec. The tasks reference both.

Numbering matters more than it looks — it gives the agent (and you) a stable handle for cross-references and a natural ordering.

The phase model behind it: specify, plan, implement, validate. Your "Plan Review" fits between plan and implement — it's the human gate. Some teams call this a "phase gate"; cc-sdd calls them "approval gates."

A common refinement: a separate folder for bug fixes since they follow a different workflow. Report → Analyze → Fix → Verify:

```
specs/      # features
bugs/       # bug fixes (different workflow)
```

## The scratchpad layer (your `.resources`)

This is the underserved problem. Two approaches in practice:

**Approach A — local-only folder inside the repo.** What you're doing now. The convention is a leading dot to signal "not part of the project proper" (`.resources/`, `.scratch/`, `.context/`, `.local/`). Then either:

- Add it to `.gitignore` (committed, shared rule), or
- Add it to `.git/info/exclude` (local-only, doesn't pollute the project's `.gitignore`).

The local-exclude trick is genuinely useful: add CLAUDE.md to your user-local Git exclude file, which is located at $GIT_DIR/info/exclude. From Git's gitignore docs: "Patterns which are specific to a particular repository but which do not need to be shared with other related repositories (e.g., auxiliary files that live inside the repository but are specific to one user's workflow) should go into the $GIT_DIR/info/exclude file." This file works like .gitignore but isn't tracked by Git and applies only to your local repository.

**Approach B — outside the repo, mounted via `additionalDirectories`.** Claude Code lets you grant read access to directories outside the repo via `.claude/settings.local.json`:

```json
{
  "additionalDirectories": ["/home/xose/ai-references/"]
}
```

This keeps reference material truly external — useful when the same references serve multiple projects (which sounds like your case with RAK-related material).

**On `.claudeignore` vs `.gitignore`:** they're independent. .claudeignore doesn't make files invisible to Claude's filesystem tools. The files still exist and are discoverable through search, but they are excluded from automatic context loading. So if you want `.resources/` ignored by git but *available* to the agent, just `.gitignore` it — Claude Code can still read it. If you want it ignored by *both*, add it to both. Claude Code currently respects .gitignore files and excludes gitignored files from @-mention autocomplete suggestions, general file awareness and reading (unless explicitly requested) — so for `.resources` you'll want it accessible by explicit reference but not auto-loaded, which is exactly what `.gitignore` (alone) gives you.

## A consolidated layout

Pulling it together, this is roughly what a well-organized AI-assisted RAK-style project would look like:

```
project-root/
├── AGENTS.md                    # entry point, hub document
├── CLAUDE.md                    # one-liner pointing to AGENTS.md (optional)
├── .claude/
│   ├── settings.json            # committed: shared perms, hooks
│   ├── settings.local.json      # gitignored: personal additionalDirectories
│   └── commands/                # slash commands: /specify, /plan, /review
├── docs/
│   ├── architecture.md          # stable, project-wide
│   ├── conventions.md           # code style with examples
│   └── constitution.md          # non-negotiables
├── specs/
│   ├── 001-feature-name/
│   │   ├── spec.md              # PRD
│   │   ├── plan.md
│   │   ├── review.md            # your plan review
│   │   ├── tasks.md
│   │   └── research.md
│   └── 002-...
├── bugs/                        # optional, separate workflow
├── src/                         # or wherever code lives
├── tests/
├── .resources/                  # gitignored — your reference materials
├── .gitignore                   # includes .resources/, .claude/settings.local.json
└── README.md                    # for humans, not agents
```

## Practical recommendations for your situation

Given what's in your repos today:

1. **Split `docs/`.** Move PRDs/Plans/Plan Reviews out of `docs/` and into `specs/NNN-feature/`. Reserve `docs/` for the stable steering layer (architecture, conventions, constitution). This is the single highest-leverage change — it stops mixing slow-changing project knowledge with fast-changing per-feature artifacts.

2. **Add an `AGENTS.md` as the hub.** Short. Six sections per the GitHub analysis: commands, testing, project structure, code style, git workflow, boundaries. Link out to `docs/architecture.md`, `docs/conventions.md`, `specs/`. Keep it under ~200 lines.

3. **Standardize the spec folder shape.** Pick a fixed set of files (`spec.md`, `plan.md`, `review.md`, `tasks.md`) and stick to it across features. The agent benefits from positional consistency: "read `specs/003-*/plan.md`" should always work.

4. **Keep `.resources/` exactly as you have it** — `.gitignore`'d but readable. If multiple projects share the same references (likely, given your RAK/LoRaWAN/local-LLM work), move them to a shared external directory and add it via `additionalDirectories` in `.claude/settings.local.json` instead. Then `.resources/` becomes per-project scratch only.

5. **A `constitution.md` is worth the 30 minutes.** This is the thing that prevents drift on the boring rules ("Markdown/ODT not docx", "use Podman not Docker", "Vulkan backend on Strix Halo"). A constitution document establishes a set of non-negotiable principles for your project. The agent will reference it; future-you will reference it.

6. **The plan review is the right gate.** This is genuinely the highest-value artifact in the chain — it's the one place a human reads the agent's reasoning before code is written. Worth formalizing as `review.md` with a short template (assumptions challenged, alternatives considered, risks accepted).

## Worth reading

- [GitHub blog: How to write a great agents.md (2,500-repo analysis)](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/) — the empirical baseline
- [Addy Osmani: How to write a good spec for AI agents](https://addyosmani.com/blog/good-spec/) — the cleanest framework write-up
- [SpecKit on GitHub](https://github.com/github/spec-kit) — the reference layout
- [cc-sdd](https://github.com/gotalab/cc-sdd) — more opinionated, "boundary-first" variant if you want stronger guardrails