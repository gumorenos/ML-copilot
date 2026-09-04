# Instructions for coding agents

These instructions apply to every change in this repository, whether made by Codex, Claude Code, OpenClaw, a human developer, or another agent.

## Source of truth and context isolation

1. Treat this repository as the durable source of truth.
2. Use only repository files, the current task, official public technical documentation intentionally researched for this project, and public repositories intentionally inspected for this project.
3. Do not use or reference external chat history, account memories, private conversations, unrelated repositories, or uncommitted notes from other agents.
4. Never put private conversation material or hidden context into repository files.
5. If required context is missing, document the unknown or ask the user; do not infer it from another project.

## Before changing anything

1. Read `README.md`, this file, and the relevant files under `docs/`.
2. Inspect the current code, migrations, tests, and working tree before editing.
3. Plan non-trivial changes and identify the applicable roadmap phase and QA gate.
4. Check current official Mercado Libre and Cloudflare documentation before relying on behavior that may have changed.
5. Preserve unrelated user changes. Do not reset, overwrite, or delete them.

The Phase 0 branch may contain an isolated read-only capability harness under src/, scripts/, and migrations/. Treat it as a reviewable connectivity artifact, not as the application UI or permission to add seller operations. Do not promote it into the Worker runtime or begin Phase 1 without explicit instruction.

## Product and architecture constraints

- This is a personal, single-owner MPE application, not an ERP or multi-tenant SaaS.
- Mercado Libre is the operational source of truth. Store only app-specific state and justified historical facts.
- Preserve the one-Worker Cloudflare architecture unless evidence and a recorded decision justify a change.
- Prefer small vertical increments over broad horizontal scaffolding.
- Do not add a VPS, production Docker dependency, Kubernetes, Redis, Postgres, Supabase, queues, microservices, or another service without measured need and an ADR.
- Keep domain/application logic independent of the React UI, Mercado Libre transport, D1, AI providers, and any future MCP adapter.
- The web application must call the service layer through its backend API. MCP is not the internal application transport.
- Keep LLM and image-provider integrations behind narrow provider interfaces when those phases begin. Do not select or implement them early.
- Do not silently broaden scope.

## Mercado Libre safety

- Use OAuth Authorization Code flow; never collect a seller password.
- Keep client secrets, access tokens, and refresh tokens server-side, encrypted at rest, absent from Git and logs.
- Implement rotating refresh tokens with cross-request serialization and atomic persistence.
- Do not claim an endpoint, field, permission, quota, or MPE behavior is supported without dated official evidence or a clearly labeled controlled verification.
- Treat API success with warnings as potentially incomplete. Re-read and verify mutations.
- All material writes require a server-created preview, explicit user confirmation, current-state revalidation, a single execution, verification, and an audit event.
- Confirmation must fail closed. A missing confirmation mechanism is not approval.
- Never expose a general-purpose write proxy to the frontend or an AI agent.
- Never perform real-account close, relist, price, stock, description, attribute, or image tests without the specific safety plan and user authorization required by `docs/QA.md`.
- AI can propose changes only. It must not invent product attributes or silently apply output.

## Secrets and data handling

- Never commit `.env`, `.dev.vars`, credentials, tokens, authorization headers, production identifiers, personal/order data, or database exports.
- Example environment files may contain variable names and safe placeholders only.
- Validate Cloudflare Access JWTs in the Worker; do not rely only on the edge policy.
- Validate every external payload and frontend request at the server boundary.
- Redact tokens, authorization headers, cookies, PII, and unnecessary upstream bodies from logs and audit records.
- Store money as integer minor units with a currency code and timestamps as UTC.
- Preserve original listing images once image processing is introduced.

## Engineering quality

- Typecheck, lint, test, and build changes in proportion to risk.
- Add unit tests for domain rules and security-sensitive helpers.
- Use mocked Mercado Libre fixtures for routine automated tests; fixtures must contain no real PII or secrets.
- Test D1 migrations from an empty database and through supported upgrade paths.
- Keep integration adapters contract-tested against recorded, sanitized response shapes.
- Add UI behavior and accessibility tests for confirmations, loading, error, and stale-preview states.
- Keep real-account smoke tests manual, narrow, reversible where possible, and separately reported.
- Do not weaken a safety check to make a test pass.

## Documentation and decisions

- Update documentation in the same change when architecture, security behavior, API evidence, data retention, or phase gates change.
- Record material choices in `docs/DECISIONS.md` with alternatives, evidence, consequences, and status.
- Keep uncertain behavior explicitly labeled as unverified; include the verification date when it becomes verified.
- Cite primary documentation near technical claims. For open-source reuse, record the repository, inspected commit, license evidence, and compatibility assessment.
- Do not copy third-party code until license compatibility and attribution requirements are documented.

## Completion checklist

Before handing off a change:

1. Review the diff and working tree.
2. Run the relevant automated checks and report what was not run.
3. Confirm no secret or sensitive data was added.
4. Check for contradictions across README, architecture, roadmap, API, security, QA, and decision files.
5. State the completed phase/gate and remaining manual verification.
6. Do not begin the next roadmap phase without instruction.
