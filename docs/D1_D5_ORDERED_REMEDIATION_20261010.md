# Sửa theo thứ tự: D1-D5, ngày 10/10/2026

> Trạng thái mới lúc 22:50: đủ 7 bảng trên storagehub_local, ledger/communication đã bật và API ledger HTTP 200. Policy BO chưa công bố và coverage vẫn UNKNOWN. Xem [báo cáo rollout](RENTAL_LEDGER_LOCAL_ROLLOUT_20261010.md); các mục thiếu schema/tắt module bên dưới là lịch sử trước rollout.

> Cập nhật lượt tiếp theo: đã đổi source ledger/outbox sang tên nghiệp vụ và thêm migration opt-in, kiểm thử trên DB MySQL mới. Xem `RENTAL_LEDGER_SCHEMA_IMPLEMENTATION_20261010.md`. Các bảng vẫn chưa rollout vào storagehub_local; các blocker policy/coverage/hold/lifecycle và quyền vẫn giữ nguyên.

## Kết quả

Không hoàn tất toàn bộ D2: các dependency thật vẫn thiếu. Đã sửa thông báo lỗi đọc tài chính và kiểm chứng adapter ngày thuê trong phiên BE local. Không sửa endpoint, DTO, quyền, schema, migration hoặc writer của thành viên khác. Không commit/push.

| Thứ tự | Công việc | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Phân biệt lỗi đọc ledger với kết quả mutation chưa chắc chắn | PASS | LedgerPanel dùng thông báo đọc dữ liệu; 401/403/404/409 giữ nguyên ý nghĩa. Có 10 test mới cho nhánh lỗi |
| 2 | Kiểm tra schema trước khi bật ledger | BLOCKED_DB_SCHEMA | Cả 6 bảng ledger đều MISSING. Không bật module, không tạo DDL |
| 3 | Kiểm chứng và bật riêng adapter ngày thuê | PASS_RUNTIME | BE chạy với `ddl-auto=validate`; Customer và Manager detail đều HTTP 200, dateSemantics COMPLETE/EXCLUSIVE |
| 4 | Communication và policy | BLOCKED | Bảng notification outbox MISSING; renewal policy chưa công bố. Không đặt giá trị chính sách thay BO |
| 5 | D2 permission, tài chính, hold, lifecycle và E2E | BLOCKED | Renewal options HTTP 409 vì thiếu policy BO; Manager thực tế thiếu rentals:update; chưa tìm thấy implementation các nguồn eligibility/hold/lifecycle/ledger coverage trong source main |

PASS_RUNTIME là kiểm chứng phiên chạy này, không phải đã sửa cấu hình khởi động mặc định hoặc chứng nhận mọi hồ sơ legacy.

## 1. Source thay đổi trong lượt này

- `src/views/rental-support-integration/LedgerPanel.tsx`: thêm `ledgerReadError`. Lỗi 500/503/network/timeout/phản hồi không hợp lệ hiển thị: **Không tải được dữ liệu tài chính. Vui lòng thử lại.** Không dùng hướng dẫn retry idempotency của mutation cho GET. Giữ riêng thông báo 401/403/404/409, không biến lỗi thành dữ liệu rỗng hay thành công.
- `src/views/rental-support-integration/integrationPresentation.test.tsx`: kiểm tra 6 lỗi đọc và 4 HTTP status cần giữ ý nghĩa. Không thay đổi test guard hoặc idempotency của mutation.
- Báo cáo này và ghi chú bổ sung trong báo cáo wiring trước đó.

Các thay đổi đổi tên thư mục, in đậm nhãn và chỉnh sửa worktree trước lượt này được giữ nguyên; không gộp chúng thành source mới của lượt sửa này. BE Git status vẫn gồm các thay đổi cũ trong contract, start-mysql.bat và các script run-dev chưa tracked.

## 2. Môi trường và schema

- FE: `http://localhost:8443`, GET trang chủ HTTP 200.
- BE: `http://localhost:8080`, GET Swagger HTTP 200.
- Datasource theo script local: MySQL 8.4, `localhost:3306/storagehub_local`, container `storagehub-mysql`. Không dùng Render/TiDB.
- Khởi động BE với overlay `spring.jpa.hibernate.ddl-auto=validate`; không dùng `create`/`update` để vượt kiểm tra.
- Flyway: **Successfully validated 12 migrations**, schema up to date, **No migration necessary**. Số record migration success đọc từ DB: 12.
- JPA validate và API khởi động thành công không chứng nhận bảng JDBC của module đang tắt. Ledger/outbox có schema guard riêng khi bật.

Đọc `information_schema.TABLES`, kết quả:

| Bảng | Trạng thái |
|---|---|
| duong_ledger_accounts | MISSING |
| duong_ledger_obligations | MISSING |
| duong_ledger_receipts | MISSING |
| duong_ledger_allocations | MISSING |
| duong_ledger_refunds | MISSING |
| duong_ledger_commands | MISSING |
| duong_notification_outbox | MISSING |

Swagger không có route ledger/communication-policy. Hai module tiếp tục tắt. Chỉ nên tạo migration sau khi thống nhất với người phụ trách database theo constraint hiện tại. Không chạy manual DDL hoặc backfill.

## 3. Ngày thuê và API đọc lại

Hồ sơ: `1031d4d6-1b84-481f-a706-7e76bd368d69`.
Cơ sở: `89fe8d93-65be-4612-91c8-a3e805e56937`.

Đã kiểm tra bằng chứng handoff/customer receipt hiện hữu, không tạo bằng chứng mới. Adapter chuẩn hóa dựa trên bằng chứng, không sửa ngày DB.

| Request/nguồn | Kết quả |
|---|---|
| GET /api/customer/rental-records/{id} | 200, COMPLETE, EXCLUSIVE, lastPermittedDate=2027-01-09, endExclusive=2027-01-10 |
| GET /api/manager/rentals/{id} | 200, cùng ngữ nghĩa ngày như Customer |
| Đọc rentals bằng HEX(id), UUID lưu binary(16) | start_date=2026-10-10, contract_end_date=2027-01-10, active; giữ nguyên dữ liệu |
| Financial/access projection | UNKNOWN; các giá trị tiền còn null, không tạo số 0 giả |
| GET /api/customer/rentals/{id}/renewal-options | 409, DEFERRED_SOURCE: BO renewal policy missing; correlation a66e8ab6-1354-4b12-a0aa-b4b6de612204 |
| GET /api/business/facilities/{id}/renewal-policy/stored | 404, Policy has not been published; correlation 2666ed0b-76ec-4d5f-b5af-ed8663e7ed16 |
| GET /api/manager/overdue-cases?page=0&size=10 | 200, data=[], completeness=PARTIAL; thiếu AUTHORITATIVE_OBLIGATIONS_ALLOCATIONS và RENTAL_TERM_POLICY_DATE_CUTOFF |

Không diễn giải danh sách quá hạn rỗng PARTIAL thành xác nhận không có công nợ/quá hạn. D2 đã vượt blocker ngày thuê, chưa vượt blocker policy và các nguồn còn lại. Không gửi quote, yêu cầu gia hạn, quyết định duyệt, payment hoặc mutation nghiệp vụ để ép test qua.

### Cấu hình ngày thuê chỉ cho phiên hiện tại

Không chỉnh `run-dev.ps1` hoặc application.properties. Khi mở terminal mới để chạy lại cùng cấu hình đã kiểm chứng:

```powershell
cd D:\semester-5\SWP\self-storage-be
$env:SPRING_APPLICATION_JSON = '{"storagehub.integration.rental-period.enabled":true,"spring.jpa.hibernate.ddl-auto":"validate"}'
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-dev.ps1
```

Nếu đã đặt SPRING_APPLICATION_JSON cho mục đích khác, cần gộp cấu hình trước, không ghi đè tùy tiện. Không thêm flag ledger/communication trước khi schema và nguồn đã đủ. Chạy script gốc trong terminal mới không có overlay sẽ không giữ flag ngày thuê của phiên này.

## 4. Dependency cần xử lý tiếp, không giả lập

| Dependency | Bằng chứng/việc cần làm | Phạm vi phụ trách |
|---|---|---|
| Schema ledger/outbox | 7 bảng chưa có; cần migration được thống nhất và validate riêng | Người phụ trách database + Dương |
| Renewal policy | Không có setting rentalRenewalPolicy cho cơ sở; API stored 404. Cần BO công bố giá trị nghiệp vụ thật | Business Owner/policy |
| Communication policy | Không có setting duongCommunicationPolicy cho cơ sở; outbox chưa có | Business Owner + communication |
| LedgerCoverageSource | Chỉ có interface/consumer, chưa có bean chứng nhận toàn bộ writer và dispute/deposit coverage | Tài chính/payment/return và Dương adapter |
| EligibilitySource | Chưa tìm thấy runtime implementation; không suy luận khả dụng/cutoff từ status đơn lẻ | Booking/availability/recovery và Dương adapter |
| ExtensionHoldSource | Chưa có implementation bảo đảm transaction và protocol lock chung | Booking/assignment/maintenance và Dương |
| ApprovalLifecycleSource | Chưa có implementation expiry/payment/signing handoff | Renewal/D3 và nguồn payment |
| Manager permission | GET auth/me 200: rentals:read có, rentals:update không có; MANAGE scope đúng cơ sở | Chủ sở hữu RBAC/seed |

Không tự grant quyền hoặc sửa shared security. Chỉ bật ledger cũng chưa đủ để tài chính COMPLETE hoặc duyệt gia hạn an toàn. Không dùng policy mặc định, receipt thử nghiệm hay DB rows chưa chứng nhận để thay nguồn xác thực.

## 5. Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Vitest integrationPresentation, duongIntegrationApi, rentalPeriodPresentation, renewalInteractionSafety, emptyDataPresentation | PASS: 5 file, 136 test |
| npm run build | PASS; cảnh báo bundle >500 kB, không phải lỗi build |
| npm run typecheck | FAIL_BASELINE: đúng 8 diagnostic trước đó, không có diagnostic ở các file sửa lượt này |
| git diff --check | PASS; có cảnh báo CRLF ở các file cũ, không có whitespace error |
| BE validate + API đọc DB thật | PASS trong phiên local với module ngày thuê bật riêng |
| Ledger/communication integration DB | BLOCKED_DB_SCHEMA |
| D2 tạo/duyệt đầy đủ | BLOCKED_DEPENDENCIES; không chứng nhận E2E hoàn tất |
| Browser UI E2E/screenshot | NOT_RUN; không có browser surface khả dụng trong phiên này |

Typecheck baseline: AdminPortalLogin.tsx (1), HomePage.tsx (3), ManagerApiStaffTasksPanel.tsx (1), ProfileView.tsx (3). Không chỉnh các module này để làm xanh kết quả.

Các kiểm tra runtime lượt này là GET và SELECT; không có mutation nghiệp vụ/schema. Các phiên login chuẩn có thể ghi session theo Auth. Không lưu token/mật khẩu trong báo cáo.
