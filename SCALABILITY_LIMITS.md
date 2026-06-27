# Tether — Scalability Limits

Tether has **no explicit caps** on users, projects, or tasks in application code. Practical limits come from the Cloudflare Durable Objects storage model, whole-document reads/writes, and client-side rendering.

This document describes current architecture, hard platform limits, practical comfort zones, and what breaks first.

## Architecture

| Layer | Storage |
|-------|---------|
| **Users** | One `UserAccount` Durable Object per Ahrens Labs account. Tether data lives in `userData.tether`: project ID list, inbox tasks, and label colors — alongside other account data (e.g. chess progress). |
| **Projects** | One `TetherProject` Durable Object per project. Each stores a single JSON document: title, description, members, and **all tasks**. |
| **Backend** | Cloudflare Worker (`workers/src/tether.js`) + Durable Object classes defined in `workers/wrangler.toml`. |
| **Frontend** | `tether.html` — loads full project summaries and full project documents; no pagination. |

### Key API patterns

- **`GET /api/tether/my-tasks`** — Fetches **every** accessible project (full document per project), plus inbox tasks, then returns tasks assigned to the current user.
- **`GET /api/tether/projects`** — One lightweight metadata fetch per project ID (parallel).
- **`GET /api/tether/project`** — Full project including all tasks.
- **`PUT /api/tether/project`** — Rewrites the **entire** project on every save.
- **Inbox** — Stored in `userData.tether.inboxTasks` within the user's `UserAccount` DO (same blob as other account fields).

There is no cross-user aggregation for Tether; each user's data is isolated in their own Durable Objects.

## Hard platform limits (Cloudflare)

These apply to SQLite-backed Durable Objects on the **Workers Paid** plan (see [Cloudflare DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)).

| Limit | Value | Impact on Tether |
|-------|-------|------------------|
| **Value size** | Key + value combined ≤ **2 MB** per `storage.put()` | Each project document and each `userData` write must stay under 2 MB. **First hard failure mode.** |
| **Storage per DO** | **10 GB** per Durable Object | Unlikely to hit before the 2 MB value limit. |
| **Number of DOs** | Unlimited (Paid) | Users and projects scale horizontally. |
| **CPU per request** | 30 seconds (default) | Very large JSON parse/serialize can time out. |

When a value exceeds storage limits, writes fail (e.g. `SQLITE_FULL`); reads and deletes still work.

There is **no Tether-specific user cap**. Total registered users are bounded by Cloudflare account/plan and billing, not by Tether logic.

## Practical capacity (estimates)

Assumptions: typical tasks are roughly **0.5–2 KB** JSON each. Tasks with long notes or Definition of Done text increase size quickly.

### Total users (platform)

| Scale | Expectation |
|-------|-------------|
| **Hundreds to tens of thousands** | Fine — each user is isolated in their own `UserAccount` DO. |
| **Much larger** | Platform and billing limits, not Tether application logic. |

Tether runs on the shared `chess-accounts` worker but does not share a monolithic datastore across users.

### Projects per user

| Scale | Expectation |
|-------|-------------|
| **~5–30** | Comfortable. |
| **~30–100** | **My Tasks** load slows — one full project fetch per project on each request. |
| **100+** | Noticeable API latency; risk of Worker timeouts for heavy accounts. |

The project **list** tab uses lighter list metadata. **My Tasks** is the expensive path.

### Tasks per project

| Scale | Expectation |
|-------|-------------|
| **~50–300** | Comfortable for list view, Gantt, and saves. |
| **~300–1,000** | Slower saves; heavy UI (especially Gantt). |
| **~1,000–2,000+** | Approaching the **2 MB project blob** limit; saves may fail. |

Every task create/update/delete re-uploads the whole project.

### Inbox and personal tasks

| Scale | Expectation |
|-------|-------------|
| **~100–500 inbox tasks** | Usually fine. |
| **Large inbox + heavy account `userData`** | Shares the **2 MB `userData`** ceiling with non-Tether account data. |

### My Tasks (assigned across all projects)

| Scale | Expectation |
|-------|-------------|
| **~50–200 visible tasks** | Smooth UI. |
| **500+** | Large API responses; slower re-renders. |
| **1,000+** | Browser DOM performance becomes a primary bottleneck (date horizon capping limits calendar span, not total task count). |

### Shared projects / collaborators

| Scale | Expectation |
|-------|-------------|
| **Small teams (2–10)** | Reasonable for normal use. |
| **Many simultaneous editors** | **Last-write-wins** on the whole project document — no merge or conflict resolution; concurrent edits can overwrite each other. |

## What breaks first (in order)

1. **Single project too large** — 2 MB save failure when editing tasks.
2. **Many projects per user** — Slow **My Tasks** load (N parallel full project fetches in `fetchAccessibleProjects`).
3. **Heavy UI** — Thousands of tasks rendered in list, Gantt, or My Tasks views.
4. **Concurrent editing** — Lost updates on shared projects (design limitation, not throughput).
5. **Oversized account blob** — `userData` (inbox + other account fields) approaching 2 MB.

## Summary

For **personal or small-team use** — a few projects and tens to low hundreds of tasks each — Tether is within its design envelope.

Pain typically appears around:

- **~50+ projects** per active user (API fan-out on My Tasks),
- **~500–1,000+ tasks in one project** (save payload size and UI),
- **~2 MB** on any single project or `userData` blob (hard storage failure).

There is no coded ceiling on **total users**; the system is suited to many independent accounts rather than one monolithic project with massive task counts.

## Future improvements (if scale requirements grow)

- Paginated or incremental APIs (project list, task list, My Tasks).
- Per-task or sharded storage instead of one JSON blob per project.
- Patch-based or row-level saves instead of full-document PUT.
- Optimistic locking or conflict handling for shared projects.
- Virtualized or windowed rendering in the browser for large task lists.

## Related code

- API handlers: `workers/src/tether.js`
- `TetherProject` Durable Object: `workers/src/tether.js` (`TetherProject` class)
- User account Tether fields: `workers/src/index.js` (`UserAccount` — `getTetherProjectIds`, `getTetherInbox`, etc.)
- Frontend: `tether.html`
