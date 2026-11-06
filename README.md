# Forest Throne — Bá chủ khu rừng

Tactical voxel auto-battler for the browser. Collect, upgrade, position, equip and command forest creatures across repeated Planning and Combat rounds.

*Auto-battler chiến thuật voxel chạy trên trình duyệt. Thu thập, nâng cấp, bố trận, trang bị và chỉ huy các sinh vật rừng qua nhiều vòng Chuẩn bị / Giao tranh.*

Author / Tác giả: **Thái Gõ** · Version / Phiên bản: **0.1**

## Stack

- TypeScript (strict, no explicit `any`)
- Three.js (WebGL renderer)
- Vite + Vitest
- pnpm (only / bắt buộc)

## Quick start / Bắt đầu nhanh

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # unit tests
pnpm build      # production build -> dist/
```

## Audio / Âm thanh

- `src/audio/MusicDirector.ts` transitions BGM between menu, planning and combat contexts, using the existing settings store for volume and mute control.
- `src/audio/ForestAmbience.ts` creates sparse procedural birds and breeze while planning. A pointer/keyboard gesture unlocks Web Audio; a hidden tab, mute, or route change suspends ambience and releases its active voices.
- `src/audio/SoundEffects.ts` plays semantic `buy`, `reroll`, `hit`, `skill`, `heal`, `ko`, `victory`, `defeat` and `draw` cues. It uses available authored samples when supplied, otherwise a bounded, short procedural oscillator tone. Failed audio initialization/resume does not abort gameplay; later interactions retry when possible.
- Planning cues fire only after successful shop actions. Combat cues are dispatched by presentation impact callbacks rather than simulation timestamps so playback follows the displayed impact even at a changed game speed.
- On teardown the app disposes its audio managers, closes owned AudioContexts, and cleans up modal keyboard listeners. The audio-specific Vitest regressions cover transient failures, externally closed contexts and late asynchronous resume/suspend settlements.

## Verified Issue Closure / Tự động đóng Issue

After completing and verifying **all** acceptance criteria for an Issue, push the implementation branch and publish an open, non-draft, same-repository PR targeting `dev`. The PR body must **begin** with an exact, plain-text attestation header. Use standalone `Closes #N`, `Fixes #N`, or `Resolves #N` lines, **exactly one** `Issue-Snapshot: #N sha256:<64 hexadecimal characters>` line for each distinct linked Issue (no extras), one `Verification: <specific targeted tests, build, and real runtime acceptance evidence>` line, and one `Verified-Head: <full 40-character current PR HEAD SHA>` line. The header fields must appear in this order: one or more `Closes`/`Fixes`/`Resolves` lines, then exactly one `Issue-Snapshot` for each declared Issue, then one `Verification` line, then one `Verified-Head` line, then an exact standalone `---` line; arbitrary Markdown belongs only after that delimiter. Blank or whitespace-only lines are not allowed within the header. Other nonempty lines, whitespace-indented declarations, code fences, HTML comments, lists, quotes, or malformed and repeated fields invalidate the entire header. Lines after `---` never count as declarations. A PR mention, passing CI, contributor-supplied digest, or `Verified-Head` text alone **never** authorizes closure.

Example PR body **before** applying the maintainer verification label (replace the digests with values computed from the actual current Issue titles and bodies):

```text
Closes #12
Fixes #14
Issue-Snapshot: #12 sha256:<SHA-256 of canonical Issue #12 title/body snapshot>
Issue-Snapshot: #14 sha256:<SHA-256 of canonical Issue #14 title/body snapshot>
Verification: tests, build and actual acceptance scenario completed
Verified-Head: <full current 40-character commit SHA>
---
Implementation notes, screenshots and review context.
```

**Exact acceptance snapshots:** The digest is SHA-256 of `JSON.stringify([String(issue.title ?? ''), String(issue.body ?? '')])`, with `issue` taken directly from GitHub's Issue API. Preserve exact title/body text, trailing LF/CRLF, whitespace, and the boundaries between the two fields; null becomes an empty string. Never hash rendered Markdown or separately copied/reformatted fields. For example, `gh api repos/OWNER/REPO/issues/12 | node -e 'let s=""; process.stdin.setEncoding("utf8"); process.stdin.on("data", x => s += x); process.stdin.on("end", () => { const i=JSON.parse(s); console.log(require("node:crypto").createHash("sha256").update(JSON.stringify([String(i.title ?? ""), String(i.body ?? "")])).digest("hex")); });'` computes the canonical digest without appending a newline. A maintainer must compare **every** Issue acceptance criterion, the evidence, and matching title/body snapshots before independently adding the verification label. The automation re-fetches both title and body before audit and closure; either changing invalidates the reviewed snapshot.

**Repository prerequisite:** GitHub independently closes linked Issues when a PR with native `Closes`/`Fixes`/`Resolves` declarations is merged into the default branch. The verification workflow cannot intercept that native behavior. An administrator **must disable** **Settings → General → Issues → Auto-close issues with merged linked pull requests** before relying on this policy, and keep it disabled. Otherwise a PR merge may close an unverified Issue without a maintainer label or audit receipt. The setting is repository-wide and is separate from this workflow; verify it in GitHub Settings during deployment.

A repository **admin or maintainer** must inspect the Issue acceptance criteria and evidence, then explicitly attest completion by adding the `issue-verified-complete` label to that PR (`gh pr edit <number> --add-label issue-verified-complete`). This separate label action may be performed by the PR author in a single-maintainer repository, but must represent actual human verification; it does not replace technical review or the exact-HEAD human merge approval required for integration. The label must exist in repository settings. Applying it invokes `.github/workflows/close-verified-pr-issues.yml`, which reads the current PR and compares its HEAD and body with the label-event webhook snapshot. It rejects drafts, fork PRs, unexpected targets, removed labels, stale evidence and edits after attestation. **Authorization policy: execution-time, not label-time.** The event history identifies the human label actor; the automation requires their effective GitHub `admin` or `maintain` role when the workflow executes and again before every Issue mutation. GitHub Issue Events do not reveal historical collaborator roles, so this does **not** prove the actor already had maintainer rights when the label was applied. An actor promoted only after labeling can pass the current-role check; strict label-time authorization requires separate trustworthy historical evidence. Do not represent the label event alone as proof of past permission.

For each explicitly declared, currently open Issue (not a PR), the automation checks existing bot receipts, re-fetches the current PR state and current labeler's effective repository role before the audit comment and again before closure, then records a verification audit comment containing the PR and tested commit before closing it as completed. It stops without further mutation if approval disappears, the labeler loses maintainer access, or PR HEAD/body/eligibility changes. Comment lookup or recording failure leaves the Issue open. If closure fails after commenting, re-run the **same unchanged Actions job** to reuse its bot receipt; do not remove and reapply the label. **Removing/reapplying the label is not supported**, even by a maintainer: the conservative authorization policy requires exactly one lifetime application of the verification label and no removals. Changes to PR HEAD/body require manual handling or a new PR with a fresh single maintainer label action. An audit comment may remain if approval changes between comment and closure. Issue closure confirms acceptance, **not** merge or release.

Audit receipt identity includes a SHA-256 fingerprint of the exact attested PR body, HEAD, PR number and Issue number. Re-running the same unchanged attestation reuses the existing bot receipt. A changed PR body cannot reuse an older receipt or be certified by a prior label-event snapshot.

The maintainer is responsible for checking **every** Issue acceptance criterion: a PR-body `Verification:` field is a human-attested evidence summary, not machine proof that all criteria passed. GitHub provides no atomic Issue-close precondition bound to PR HEAD and label state, so a narrow race remains between the final live approval check and the Issue update. The audit receipt records the attestation, not a claim that the close call already succeeded.

The closure workflow serializes verification events across PRs sharing Issues. GitHub Actions `queue: max` retains up to 100 pending runs in this repository-wide concurrency group; excess runs are canceled and require a fresh label event. External Issue writers and the non-atomic final approval check remain concurrency limitations.

The workflow uses `pull_request_target` and executes only trusted script code from the repository's **default branch**; it never checks out PR code. This automation is **not active** merely because a feature PR contains it: human-approved integration and subsequent deployment of both workflow and script onto the default branch are prerequisites. On PR publication without the maintainer label, no closure runs. This deliberate approval gate prevents premature closure of unverified work.

For public repositories, GitHub can block `pull_request_target` workflows through Actions event policies, including its default protection when enforcement applies. Before enabling closure in production, inspect the repository's current Actions policy and insights, and explicitly allow this event through an applicable policy if required; a merged workflow alone does not guarantee runnable events.

## Layout / Cấu trúc

```
src/
  core/        shared types, rng, events, i18n, icon authority
  game/        canonical rules: run state, board, economy, shop, merge,
               inventory, craft, tech, synergy, augments, combat, ai, loot
  content/     unit catalog, bosses, items, recipes, augments, environments
  persist/     save envelope, settings, collection, achievements
  render/      3D world, board, unit rigs, vfx, camera
  ui/          DOM screens, HUD, tooltips, modals (asset-first)
  platform/    audio, input, haptics, speech, discord, service worker
  net/         co-op / PvP fortress contracts
  app/         boot, router, loading
```

Gameplay rules live only in `src/game`; rendering and UI read and stage that state.

*Luật chơi chỉ nằm ở `src/game`; render/UI chỉ đọc và dàn dựng state đó.*

## Item Registry / Danh mục vật phẩm

`src/core/itemRegistry.ts` is the single source of authored materials, equipment, and recipes. Crafting, equipment, loot, UI, and persistence consumers resolve canonical identities through `getItem(id)`, `getEquipment(id)`, and `getRecipe(id)` instead of maintaining parallel catalogs.

- `loadItemRegistry(source)` rejects invalid catalogs before publishing definitions: duplicate identifiers, unknown ingredients or outputs, invalid tiers and grid footprints, translation-equivalent recipe patterns, and dependency cycles.
- The authored catalog currently has six materials, two equipment definitions, and one recipe (`tear` → `eq_blue_buff`). New content requires authored definitions and matching valid/invalid registry and transaction fixtures.
- Save envelopes use schema **v5** and preserve unknown string item IDs, duplicates, ordering, and co-op ownership. Unknown items count toward inventory capacity but cannot be equipped, crafted, or sold until defined.
- Migration returns rejected equipment to its original player's bag and recovers equipped IDs from unknown/malformed units or board entries beyond the canonical 25 tiles. Existing bag items come first, followed by recovered board and bench equipment in traversal order. Valid equipped items remain on their units, and repeated migration does not duplicate recovered items.
- Legacy recovered items remain owned and visible even when the item bag exceeds current inventory capacity; this does not grant capacity for new loot.
- Crafting offers only ingredients referenced by authored recipe patterns (including equipment when a recipe explicitly uses it). Unknown/non-ingredient owned IDs remain in the bag but cannot be staged through the ingredient picker.
- Crafting only commits the item bag and craft history after validating a canonical recipe and owned ingredients; invalid recipes leave both unchanged.


## Spec

The product contract is `.agents/plans/pending/docs.spec.forest-throne-rebuild.md`.

*Hợp đồng sản phẩm: `.agents/plans/pending/docs.spec.forest-throne-rebuild.md`.*

## Contributing / Đóng góp

Follow `.agents/rules/commits.md` for commit messages. Use `pnpm` for every command.

*Commit theo `.agents/rules/commits.md`. Mọi lệnh dùng `pnpm`.*

## License / Giấy phép

Source-available, all rights reserved. See [LICENSE](LICENSE).

*Mã nguồn chỉ để xem và đóng góp vào repo chính thức. Xem [LICENSE](LICENSE).*
