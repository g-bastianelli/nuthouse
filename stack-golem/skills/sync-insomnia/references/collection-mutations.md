# Insomnia collection mutations

Read this only after selecting and inspecting the target Git-Synced YAML collection.

## Add a request

- Generate a fresh `req_<hex32>` identifier following the collection's existing pattern.
- Include the URL, method, name, metadata, headers, and body fields expected by neighboring
  requests.
- Set `sortKey`; collections conventionally use a negative current timestamp.
- Use Unix timestamps in milliseconds for `created` and `modified`.

## Modify a request

Locate it by stable request identity and update only the requested URL, method, headers,
body, or metadata. Preserve unrelated fields and ordering.

## Remove a request

Delete only the selected request entry. Check for folder or environment references that
would become invalid, and report them before committing.

## Header rules

- Add `Content-Type` only when the request has a body that needs it.
- Represent bearer authentication as `Authorization: Bearer {{token}}` unless the
  collection already centralizes authentication differently.

Show the exact YAML diff before the commit gate. Never infer secrets or embed a real token.
