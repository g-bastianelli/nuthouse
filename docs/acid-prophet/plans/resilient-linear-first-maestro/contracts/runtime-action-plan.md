# contract: runtime-action-plan

## Shape

```ts
type RuntimeMatch = {
  issueId: string;
  taskId?: string;
  workspaceIds: string[];
  terminalIds: string[];
  activeTerminalIds: string[];
  exitedTerminalIds: string[];
  dataState: "known" | "unknown";
};

type RuntimeAction = {
  issueId: string;
  action: "create" | "reuse" | "monitor" | "confirm" | "ambiguous" | "non-transportable";
  taskId?: string;
  workspaceId?: string;
  terminalId?: string;
  reason?: string;
  forced: boolean;
  linearClassification: "ready" | "started";
  linearStatusType: string;
  confirmationAccepted?: true;
  forceAuthorized?: true;
  forceInvocationId?: string;
  forceBypassedBlockerIssueIds?: string[];
  forceBypassedUncertainties?: Array<{ issueId: string | null; code: string }>;
  forceRefusal?: string;
};

type RuntimeActionPlan = {
  actions: RuntimeAction[];
  selectedIssueIds: string[];
  confirmationIssueIds: string[];
  capacityUsed: number;
};
```

## Origin

- source: Architecture:153
- producer: runtime inspector and `planRuntimeActions`
- consumer(s): `orchestrate`, `spawn`, `reconcile`
- covers: AC-008, AC-009, AC-011, AC-013, AC-014, AC-015, AC-016, AC-017

## Invariants

- Only selected Linear issues enter the plan.
- Zero/one/multiple exact workspaces map to create/reuse/ambiguous.
- One exact active terminal maps to monitor and consumes one capacity slot.
- Started create/reuse and forced create/reuse remain `confirm` until their exact confirmation is supplied.
- Force authorization is bound to one invocation id and exact bypassed blocker ids.
- Every action echoes its Linear classification and raw normalized status so dispatch cannot reclassify it.
- Terminal issues never enter this contract.

## Errors

- Missing binding affects one issue.
- Multiple exact runtimes remain issue-scoped ambiguity.
- A mismatched runtime context, expanded scope, or normalized/LLM-shaped match is rejected at the boundary.

## Forensic audit boundary

`validateRuntimeAuditSnapshot` and `scripts/runtime-snapshot.mjs validate-audit` reuse the
strict raw context/scope/runtime validation without invoking this action planner. They
accept opaque non-terminal `ready`, `started`, `blocked`, and `unknown` rows for explicit
`reconcile` inspection, reject terminal rows, and never reclassify Linear state.
