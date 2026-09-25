# State and data ownership

Read this before adding selectors, fetching, URL state, Context, or local state.

Choose the highest durable owner that matches the state:

1. Server state → the repository's query/data library.
2. Shareable or refresh-persistent view state → typed URL search parameters.
3. Low-frequency session state or dependency injection → one-purpose Context
   exposed through a dedicated hook.
4. Ephemeral unsaved UI state → local `useState`.

Do not copy server data into component state. Derive render values from the
query result so cache updates remain visible.

Route-aware code owns URL reads and writes. Pass the current value and explicit
callbacks into route-agnostic components or libraries.

Do not use `useEffect` for fetching. Use an effect only to synchronize React
with an external system, keep its dependencies complete, and leave a short
comment when the synchronization reason is not obvious.
