# Scaleway resource cookbook

Read the matching family only. Confirm every command with `--help`; examples show discovery shape,
not authorization to mutate.

## Common reads

```bash
scw iam application list name=<name> -o json
scw iam policy list application-ids.0=<app-id> -o json
scw iam policy get <policy-id> -o json
scw iam permission-set list -o json
scw rdb instance list -o json
scw rdb instance get <id> -o json
scw rdb database list instance-id=<id> -o json
scw redis cluster list -o json
scw instance server list -o json
scw instance server get <id> -o json
scw registry namespace list -o json
scw registry image list namespace-id=<id> -o json
scw cockpit get -o json
```

Always add `-o json` before parsing with `jq`.

## IAM replacement semantics

`scw iam rule update` replaces all rules. Fetch the complete current policy, reconstruct every
rule, and show the full replacement before approval. Permission sets with `projects` and
`organization` scope types cannot share a rule; discover scope types and keep separate rules.

Changing rules uses `iam rule update`, not `iam policy update` (metadata only). Creating policies
may require both `IAMApplicationManager` and `IAMPolicyManager`.

## Known diagnostic edge

For provider failures around cockpit data-source discovery, pass `projectId` explicitly before
blaming the remote service; provider versions that infer `projects[0]` can panic on an empty list.
Treat this as a hypothesis until current command output confirms it.
