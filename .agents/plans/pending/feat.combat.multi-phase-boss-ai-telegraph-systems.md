# WBS-028: Multi-Phase Boss AI & Telegraph Systems

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-028 · Phase COMBAT
- **Nhánh đích:** `feat/combat/multi-phase-boss-ai-telegraph-systems`
- **Tham chiếu:** `§16.15, §19, A34`
- **Phụ thuộc:** Deps: WBS-019, WBS-024
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-028: Multi-Phase Boss AI & Telegraph Systems** `§16.15, §19, A34` *(Deps: WBS-019, WBS-024)*
  - **Mô tả:** Cơ chế chiến đấu của 5 Trùm Cuối (Cổ Thụ Rừng Rậm, Ma Sói Bóng Đêm, Bão Ưng Sấm Sét, Thạch Quái Khổng Lồ, Nhện Chúa Hang Sâu) với thanh nộ độc lập, đổi phase khi dưới 50% HP và hiển thị vùng cảnh báo telegraph đỏ trước khi tung chiêu nộ.
  - **Tiêu chí nghiệm thu:** Boss chuyển giai đoạn mượt mà; telegraph hiển thị đúng ô chịu đòn trước 1 lượt đánh.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-04: A34/A84 xác nhận roster boss hiện hành là Ember Dragon / Storm Phoenix / Venom Hydra / Earth Colossus / Tempest Jelly; lịch round và rage cost theo từng boss/star đã có. Đã bỏ fallback sai tự chế mọi boss thành đòn 1.5× toàn sân; boss sparse giờ chỉ giữ targeting/family identity được author và không sinh damage/heal/shield/status magnitude khi manifest chưa có số. WBS prose về 5 tên boss cũ, phase dưới 50% HP và telegraph đỏ trước 1 lượt không có contract authoritative tương ứng trong A34/A84 hiện tại, nên không được bịa thêm và mục này vẫn để chưa hoàn thành.
