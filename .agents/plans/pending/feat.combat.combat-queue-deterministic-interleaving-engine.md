# WBS-019: Combat Queue & Deterministic Interleaving Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-019 · Phase COMBAT
- **Nhánh đích:** `feat/combat/combat-queue-deterministic-interleaving-engine`
- **Tham chiếu:** `§16.1, §16.14, A11`
- **Phụ thuộc:** Deps: WBS-004, WBS-005
- **Trạng thái WBS:** Đã sửa và kiểm chứng queue trên feature branch; chờ PR review/merge vào `dev` và đóng Issue #10. Giữ plan ở `pending/` đến khi nghiệm thu tích hợp.

## Nội dung
- [ ] **WBS-019: Combat Queue & Deterministic Interleaving Engine** `§16.1, §16.14, A11` *(Deps: WBS-004, WBS-005)*
  - **Mô tả:** Hàng đợi lượt đánh xác định: giới hạn cứng 20 chu kỳ. Quét phe TRÁI (cột 4→0, hàng 0→cuối) và phe PHẢI (cột 5→9, hàng 0→cuối). Chia chunk gồm ô trống và unit kế tiếp để đan xen L/R chuẩn xác.
  - **Tiêu chí nghiệm thu:** Ô trống tham gia định thời presentation nhưng không làm trôi thứ tự hành động thật.
  - **Audit Note (2026-11-01, Issue #17):** Test `tests/combat.test.ts` trước đây xác nhận một phần deterministic interleaving, nhưng chưa đủ để đóng WBS. Issue #10 vẫn mở: `turnOrder` và `turnTimeline` phân kỳ, `turnChunks` có thể làm mất lượt unit trùng ô, thiếu test death giữa cycle, golden quá brittle và bằng chứng Bun chưa tái lập được. Giữ plan ở `pending/` cho đến khi hoàn tất acceptance Issue #10; sau đó dùng `/plan-done` (không chuyển tay sang `done/`).

## Bằng chứng triển khai (2026-11-01)

- `src/core/combat.ts`: `turnOrder()` dùng chính timeline mà `simulate()` thực thi. Scan theo cột/hàng canonical; mỗi ô có thể chứa nhiều fighter được xếp theo UID để không mất lượt, kể cả khi dữ liệu placement bị trùng tọa độ. Mỗi fighter tạo một chunk; ô trống chỉ sinh sự kiện presentation.
- `tests/combat.test.ts`: thêm regression duplicate-cell có cả thứ tự `turnOrder()` và các sự kiện `simulate()`; DoT chết ở đầu cycle, lượt của fighter chết trước khi đến queue, 20-cycle cap, deterministic sparse chunk. Thay full empty-event golden bằng bất biến presentation và thứ tự hành động.
- **RED trước sửa:** `pnpm exec vitest --run tests/combat.test.ts -t 'schedules every fighter sharing a scan cell'` thất bại: nhận `zeta,right,alpha`, mong `alpha,right,zeta`.
- **GREEN sau sửa:** `pnpm exec vitest --run tests/combat.test.ts` — 41/41 passed; `pnpm typecheck` — PASS; `pnpm build` — PASS; `git diff --check` — PASS.
- **Direct smoke:** `bun -e` import `materializeCombat`, `turnOrder`, `simulate` từ `src/core/combat.ts`, chạy hai LEFT fighter cùng ô + một RIGHT fighter; kết quả `{order:["a","r","z"],first:["a","r","z"],cycles:20,actions:60,alive:{L:2,R:1}}` với seed 29, HP cao và rage gain 0. Kết quả không dựa vào Bun claim lịch sử thiếu script tái lập; test Vitest trong repository là fixture tái lập tương đương.

Lệnh direct smoke tái lập từ root repository (không cần thay đổi source):

```bash
bun -e 'import { materializeCombat, simulate, turnOrder } from "./src/core/combat.ts"; const f = materializeCombat([{uid:"z",baseId:"titan_earth",star:1,row:0,col:4},{uid:"a",baseId:"titan_earth",star:1,row:0,col:4}], [{uid:"r",baseId:"titan_earth",star:1,row:0,col:5}]); for(const x of f){x.maxHp=x.hp=1000000;x.atk=x.matk=1;x.rageMax=1000;x.crit=x.evade=0}; const order=turnOrder(f).map(x=>x.uid); const result=simulate(f,{seed:29,rageGain:{L:0,R:0}}); const firstEnd=result.events.findIndex(e=>e.t==="cycle"&&e.cycle===2); const first=result.events.slice(1,firstEnd).filter(e=>e.t==="basic"||e.t==="miss"||e.t==="skip").map(e=>e.src); const cycles=result.events.filter(e=>e.t==="cycle").length; console.log(JSON.stringify({order,first,cycles,actions:result.actions,alive:result.alive})); if(JSON.stringify(order)!==JSON.stringify(["a","r","z"])||JSON.stringify(first)!==JSON.stringify(order)||cycles!==20||result.actions!==60) process.exit(1);'
```
- **Integration gate:** Chưa merge, chưa có human approval, Issue #10 chưa đóng. Không dùng `/plan-done` trước nghiệm thu tích hợp.
