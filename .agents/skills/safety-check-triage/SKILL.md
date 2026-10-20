---
name: safety-check-triage
description: Triage tool calls rejected with "This tool call was blocked by OpenAI's safety checks." in Forest Throne. Preserve the refusal, record the blocked action, and route only separate authorized work through 1DevTool/OpenCode when orchestration is enabled; never retry or reassign the rejected operation to bypass the check.
---

# Safety-check triage

Apply only when a **current** tool result explicitly says `This tool call was blocked by OpenAI's safety checks.` or shows an equivalent active platform safety refusal. Earlier chat text and old logs are not a new refusal.

1. **Stop the rejected operation.** Do not retry it unchanged, split it across calls, modify phrasing, switch models/providers, or assign the same operation to OpenCode or another agent. Record the exact failed operation, tool, and available error details. Do not infer that unrelated tool calls were blocked.
2. **Keep already completed work.** Preserve existing files and successful tool results. Identify the remaining independently authorized tasks; continue those normally when possible.
3. **Use 1DevTool orchestration only for separate permitted tasks.** Inspect the live `xd://` catalog and orchestration device docs. Read-only `orchestration_explain`/`orchestration_recommend` can check whether the capability is enabled. Draft or modify charts only with the app's own human-enabled draft session and required revision/hash; a draft never means the routing is active. Human dispatch/activation is authoritative.
4. **When OpenCode is appropriate**, describe a standalone permitted task with its own acceptance criteria, exclusions and repository scope. Hand it off only through an enabled, authorized 1DevTool workflow; the rejected action must not appear in the delegated instructions. Do not present task creation as agent assignment.
5. **If the orchestrator is disabled** (for example HTTP 403 `Feature 'orchestrator' is not enabled`), report that exact capability blocker; do not claim automatic delegation has been configured.
6. **Report** what succeeded, what was rejected, and what remains. Ask for a safety review only if needed. Never treat ordinary user confirmation as an override of a platform safety refusal.

## Decision examples

- A request to fix a broken test is separately authorized; a previously refused unrelated network operation remains refused. The test fix may be assigned to OpenCode if normal orchestration allows it.
- A refused command to modify a protected resource may **not** be repackaged as an OpenCode task to modify the same resource. Mark it blocked and report the error.

This skill defines a safe **response procedure**, not a privileged hook, an automatic tool-error interceptor, or a bypass mechanism.
