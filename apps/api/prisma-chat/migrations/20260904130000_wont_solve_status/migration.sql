-- Four-state lifecycle: open | solved | not_solved | wont_solve.
-- in_progress is retired: API and UIs no longer expose it (the value stays in
-- the Postgres type — Postgres cannot drop enum values — but nothing writes it).
ALTER TYPE "ConversationStatus" ADD VALUE 'wont_solve';
