# WBS-020: Damage Calculation Pipeline, Mitigations & Critical Strikes

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-020 · Phase COMBAT
- **Nhánh đích:** `feat/combat/damage-calculation-pipeline-mitigations-critical-strikes`
- **Tham chiếu:** `§16.7, §16.10, A12, A13, A14, A74`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-020: Damage Calculation Pipeline, Mitigations & Critical Strikes** `§16.7, §16.10, A12, A13, A14, A74` *(Deps: WBS-019)*
  - **Mô tả:** Đường ống tính toán sát thương: độ chính xác cơ bản 95%, né tránh clamp 0..0.75, chí mạng bỏ qua giáp/kháng phép, công thức dự trữ vàng (+1% mỗi 2 gold trên 10, cap 2.0x ở 210 gold), khắc chế hệ & nguyên tố (+50%).
  - **Tiêu chí nghiệm thu:** Gold multiplier không bị làm tròn sai số floor; chí mạng bỏ qua DEF/MDEF đúng luật A13.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Test toán học goldMultiplier khớp 100% spec.
