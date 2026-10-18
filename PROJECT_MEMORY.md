# Project Memory

## Product Boundary

- FillNest is a local-first Chrome extension for field-aware plain-text
  templates on supported web input fields.
- It must not fill whole pages, overwrite whole field values automatically, or
  submit forms.
- The V1 product excludes backend services, network-dependent features, AI,
  accounts, synchronization, payments, and team features.

## Canonical Project Records

- `AGENTS.md` contains non-negotiable project instructions and validation
  commands.
- `PROJECT.md` and `CONTEXT.md` define the product and domain language.
- `docs/agent-handoff.md` is the detailed multi-agent reading order and
  delivery workflow.
- `DEVELOPMENT.md` is the single concise current-status record.
- `tasks/` and `docs/adr/` hold durable task and architecture records.

## Memory Maintenance

Keep this file for durable product boundaries and document locations. Record
current state in `DEVELOPMENT.md`; record dated history in task records,
release notes, or version control.
