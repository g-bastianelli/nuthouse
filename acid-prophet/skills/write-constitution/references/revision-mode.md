# Existing constitution revision

Read this only when `docs/acid-prophet/constitution.md` already exists.

Read the complete artifact, print its current articles, and ask:

```text
revise (r) | append articles (a) | replace from scratch (x) | stop (s)
```

- `revise` keeps unrelated articles and increments the version once.
- `append` leaves existing articles intact and adds only newly approved ones.
- `replace from scratch` requires a second explicit confirmation before discarding the
  existing body.
- `stop` exits without a write.

The later article-level ratification gate still applies in every branch, including a
confirmed replacement.
