# Deck Durable Object → D1 migration

Keep `/api/deck/*` stable. Auth/session and `DECK_SYNC` stay on Durable Objects.

## Status (Phases 0–6)

| Phase | Status |
|---|---|
| 0 Schema + `DECK_DB` | Done |
| 1 Dual-write UA + DeckShare → D1 | Done (`DECK_D1_WRITE=1`) |
| 2 Backfill | Done — 19 decks / 157 cards / 13 shares |
| 3 Dual-read compare | Done (`DECK_D1_COMPARE`) |
| 4 Flip reads | Done (`DECK_D1_READ=1`) |
| 5 Stop DO/UA deck writes | Done (`DECK_D1_PRIMARY=1`) |
| 6 Admin SQL counts | Done |

Model: per-user encrypted deck JSON blob + relational `deck_shares` / members (hydrate batches shares, no N DO fan-out).

```bash
curl -sS -X POST "https://chess-accounts.matthewahrens.workers.dev/api/deck/admin/backfill-d1" \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: $TEST_SECRET" \
  -d '{}'
```

Tests: `node workers/scripts/test-deck-d1.mjs`
