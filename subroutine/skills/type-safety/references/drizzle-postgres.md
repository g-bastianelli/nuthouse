# Drizzle/Postgres enum representation

Read this only when introducing or changing a finite-value field in Drizzle/Postgres.

Prefer a typed text column plus validation at the application boundary to `pgEnum` when
the repository has no contrary convention. PostgreSQL enum migrations make removal and
renaming unusually rigid, while the TypeScript union and boundary schema still preserve
the finite value set.

Follow an established repository-wide enum strategy when one exists; this reference is a
default for an otherwise undecided representation, not a migration mandate.
