# Linear provider and context reuse

Use the active runtime's available Linear connector. Discover its actual read/write tools and
schemas; do not require a Claude-specific MCP name on Codex. If no connector is available, use an
installed Linear CLI only after inspecting its help for the needed operation. Do not invent
commands, endpoints, or field names. If neither provider works, report the access limitation.

A caller may pass current raw Linear records as `LINEAR_CONTEXT`, inline or by an absolute
readable path, with the relevant identifiers and retrieval context. Reuse these records for
scouting/drafting instead of fetching the same data twice. Preserve source references and fetch
missing fields. A prose summary, stale cache, or absent relation field is not an authoritative
replacement for current data. Local source material can still support a labeled draft while
unavailable metadata blocks external creation.

Use scoped reads and paginate when completeness matters, especially issue lists, blocking
relations, and exact-marker recovery. Do not turn an incomplete page into a complete graph.
Scouts and drafters only read. Skills own mutations within user authorization. An ambiguous
write failure must be reconciled through the same workspace and exact mutation marker before
retrying; switching providers is not a reason to replay a potentially successful write.
