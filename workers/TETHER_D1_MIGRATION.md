# Tether Durable Object → D1 migration

Keep `/api/tether/*` stable. Auth/session and `TetherSync` stay on Durable Objects.

## Status (Phases 0–6)

| Phase | Status |
|---|---|
| 0 Schema + `TETHER_DB` binding | Done |
| 1 Dual-write | Done (`TETHER_D1_WRITE=1`) |
| 2 Backfill tooling | Done — production backfill: 12 projects, 156 tasks |
| 3 Dual-read compare | Done (`TETHER_D1_COMPARE=1` to enable) |
| 4 Flip reads | Done (`TETHER_D1_READ=1`) |
| 5 Stop DO project writes | Done (`TETHER_D1_PRIMARY=1`) |
| 6 Inbox/prefs on D1 | Done (`TETHER_D1_USER_DATA=1`) |

Reads still heal DO → D1 on miss. Full backfill:

```bash
curl -sS -X POST "https://chess-accounts.matthewahrens.workers.dev/api/tether/admin/backfill-d1" \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: $TEST_SECRET" \
  -d '{}'
```

## Flags (`workers/wrangler.toml` `[vars]`)

| Var | Meaning |
|---|---|
| `TETHER_D1_WRITE=1` | Dual-write projects/inbox/prefs to D1 |
| `TETHER_D1_COMPARE=1` | Log fingerprint mismatches (DO vs D1) |
| `TETHER_D1_READ=1` | Serve project list / project / my-tasks from D1 |
| `TETHER_D1_PRIMARY=1` | Stop `TetherProject` DO writes |
| `TETHER_D1_USER_DATA=1` | Inbox/prefs/membership index primary on D1 |

## Code

- Schema: `workers/migrations/tether/`
- Layer: `workers/src/tether-d1.js`
- Routing: `workers/src/tether.js`
- Tests: `node workers/scripts/test-tether-d1.mjs`
