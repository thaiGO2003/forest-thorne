# WBS-071: Version Information & Release Notes Modal

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-071 · Phase UI
- **Nhánh đích:** `feat/ui/version-information-release-notes-modal`
- **Tham chiếu:** `§41, A51.1, A107.5`
- **Phụ thuộc:** Deps: WBS-049, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-071: Version Information & Release Notes Modal** `§41, A51.1, A107.5` *(Deps: WBS-049, WBS-050)*
  - **Mô tả:** User-facing version surface lấy `version` từ `APP_VERSION_TAG`, `updatedAt` từ `APP_LAST_UPDATED`, và ordered localized notes từ 12 slot Planning version notes.
  - **Tiêu chí nghiệm thu:** Modal hiển thị version + update date + numbered notes; backdrop/close đều dismiss và opening tuân thủ single-modal/blocking-input rules.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: version/release-note data may be read-only metadata, but A107.5 modal rendering/dismissal and blocking-input rules are presentation integration; no gameplay mutation belongs here.
