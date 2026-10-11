# Tên nghiệp vụ và schema ledger/outbox — 10/10/2026

> Cập nhật lúc 22:50: đã rollout migration vào storagehub_local, bật ledger/communication và validate PASS. Xem [báo cáo rollout](RENTAL_LEDGER_LOCAL_ROLLOUT_20261010.md). Nội dung bên dưới là kết quả lượt chuẩn bị trước rollout, không phải trạng thái DB hiện tại.

## Kết quả hiện tại

Đã đồng bộ source runtime, schema guard, test và contract sang tên bảng nghiệp vụ, không thêm bảng có tiền tố tên thành viên. Đã soạn migration opt-in và kiểm chứng Flyway/MySQL trên DB test mới; chưa áp dụng vào storagehub_local hoặc DB chung.

| Bảng | Vai trò |
|---|---|
| rental_ledger_accounts | Liên kết hồ sơ thuê và revision sổ tài chính |
| rental_ledger_obligations | Khoản phải thanh toán |
| rental_ledger_receipts | Khoản thu cùng bằng chứng |
| rental_ledger_allocations | Phân bổ khoản thu vào nghĩa vụ |
| rental_ledger_refunds | Dành tiền hoàn và ghi nhận chi hoàn |
| rental_ledger_commands | Chống xử lý trùng khi retry |
| notification_outbox | Hàng đợi thông báo, retry và biên nhận |

Không đổi tên bảng đã tồn tại, không sao chép/đổi tên payments hoặc refunds hiện hữu. Không sửa HTTP endpoint, DTO, FE client, quyền dùng chung, Payment/Booking/Return hoặc writer capacity. FE không cần đổi client do tên bảng mới không thuộc API contract.

## Migration và UUID

BE: `src/main/resources/db/integration-migration/V2026101001__create_rental_ledger_and_notification_outbox.sql`.

- Không thuộc `classpath:db/migration` mặc định, nên run-dev.ps1 không tự áp dụng vào DB đang dùng.
- Chỉ CREATE 7 bảng mới kèm index, CHECK, UNIQUE và FK. Không ALTER/DROP, seed policy, cấp quyền hoặc backfill số dư.
- UUID JDBC giữ CHAR(36) ascii_bin; cột generated/stored BINARY(16) dùng UNHEX(REPLACE(...)) nối FK tới rentals/users/facilities/renewals/file_assets/notifications, không sửa kiểu UUID bảng chung.
- 9 FK tới bảng chung đã được kiểm tra trên MySQL 8.4. Composite FK trong allocation/refund bảo vệ liên kết cùng Rental.
- FK kiểm sự tồn tại; không thay thế xác minh tuple customer/facility/Rental, file ownership, tiền thật hoặc financial coverage.
- Resource/event outbox là tham chiếu đa hình: không gắn FK sai vào một bảng duy nhất.
- CHECK phân biệt RESERVED/EXECUTED và PENDING/INBOX/ACKNOWLEDGED; không coi queue hay quyết định hoàn là chứng cứ giao thông báo/chi tiền.
- FK có thể hạn chế xóa parent khi có dòng ledger/outbox; cần đánh giá rollout, không hứa không ảnh hưởng mọi thao tác xóa sau khi bật module. Không thêm CASCADE xóa lịch sử tài chính.
- DDL MySQL có thể auto-commit; migration không hứa rollback DDL toàn bộ. Không IF NOT EXISTS để che một bảng cùng tên nhưng schema sai.

Chỉ sau khi thống nhất schema rollout với người phụ trách database mới thêm location `classpath:db/migration,classpath:db/integration-migration` trên DB đích. Chưa chứng nhận TiDB hoặc production. Không thay migration/checksum đã áp dụng.

## File BE thay đổi trong lượt này

- LedgerStore.java, LedgerSchemaGuard.java: chỉ thay tên bảng trong SQL.
- NotificationOutbox.java, CommunicationSchemaGuard.java: chỉ thay tên bảng trong SQL.
- LedgerStoreJdbcTests.java, NotificationOutboxJdbcTests.java, CommunicationPersistenceIntegrationTests.java: đồng bộ SQL và đường dẫn resource test.
- Đổi tên hai test resources thành rental-ledger-test-schema.sql và notification-outbox-test-schema.sql; không xóa nội dung test.
- Thêm migration opt-in và README hướng dẫn rollout.
- Thêm RentalIntegrationMySqlSchemaTests: chỉ nhận URL localhost/127.0.0.1, database mới rỗng có tiền tố storagehub_schema_test_; từ chối DB đã có bảng hoặc DB khác. Flyway clean bị tắt; test không xóa database khi xong.
- Cập nhật LEDGER_COMMUNICATION_INTEGRATION_API_CONTRACT.md theo source/schema mới.

Các thay đổi có trước ở RENEWAL_OPERATIONS_API_CONTRACT.md, start-mysql.bat và run-dev scripts được giữ nguyên. Không commit/push hoặc thay worktree của người dùng.

## Kiểm chứng đã hoàn tất

| Kiểm tra | Kết quả |
|---|---|
| LedgerStoreJdbcTests | PASS: 27 test |
| NotificationOutboxJdbcTests | PASS: 14 test |
| CommunicationPersistenceIntegrationTests | PASS: 15 test; HTTP/transaction H2 cô lập, không DB chung |
| RentalIntegrationMySqlSchemaTests | PASS: 4 test; MySQL 8.4 thật, 13 migration thành công và validate PASS |
| Hồi quy ngày thuê, gia hạn và xử lý D3 | PASS: 7 class, 79 test |
| Tổng BE cuối cùng | PASS: 56 ledger/outbox + 4 MySQL + 79 hồi quy = 139 test; không cộng lại lần chạy lặp |
| FE regression | PASS: 5 file, 136 test (integrationPresentation, duongIntegrationApi, rentalPeriodPresentation, renewalInteractionSafety, emptyDataPresentation) |
| MySQL outbox | PASS: commit/đọc lại, retry cùng key không tạo dòng mới; FK chặn notification không tồn tại; INBOX chưa có biên nhận; ACK retry giữ thời điểm đầu |
| Source runtime và contract riêng | Không còn câu SQL/tên bảng tiền tố cá nhân cũ |
| Đối chiếu 4 file runtime với Git HEAD | Sau khi chuẩn hóa tên bảng ngược lại, source khớp HEAD; không đổi handler/thuật toán |
| BE git diff --check | PASS; chỉ cảnh báo chuẩn hóa CRLF, không whitespace error |
| storagehub_local | Không có 7 bảng mới, Flyway vẫn 12 success; ngày hồ sơ thuê giữ nguyên |
| GET Swagger và detail Customer/Manager | HTTP 200; dateSemantics COMPLETE/EXCLUSIVE; financialSummary vẫn UNKNOWN đúng nguồn |

Có một lỗi compile phát sinh ở test MySQL mới (AssertJ overload với TransactionTemplate.execute), đã sửa bằng biến UUID có kiểu rõ ràng rồi chạy lại PASS. Không sửa code thành viên khác để làm xanh test.

Lệnh đã chạy:

```powershell
# BE: H2 cô lập, không dùng datasource của run-dev.ps1
.\mvnw.cmd '-Dtest=LedgerStoreJdbcTests,NotificationOutboxJdbcTests,CommunicationPersistenceIntegrationTests' test
.\mvnw.cmd '-Dtest=RentalPeriodTests,ProjectHandoffRentalPeriodAdapterTests,RenewalDateConsumerTests,CustomerReceiptPeriodCompatibilityTests,RenewalPreparationTests,RenewalWorkflowIntegrationTests,RenewalOperationIntegrationTests' test

# BE: chỉ sau khi đặt biến môi trường tới DB MySQL test mới rỗng
.\mvnw.cmd '-Dtest=RentalIntegrationMySqlSchemaTests' test

# FE
npm.cmd run test -- src/views/rental-support-integration/integrationPresentation.test.tsx src/services/duongIntegrationApi.test.ts src/views/rental-api/rentalPeriodPresentation.test.tsx src/views/rental-api/renewalInteractionSafety.test.tsx src/views/rental-api/emptyDataPresentation.test.tsx
```

Không chạy lại FE build/typecheck trong lượt naming/schema này vì không đổi FE source. Kết quả lượt trước: build PASS, typecheck 8 lỗi baseline. Không tuyên bố typecheck toàn repo PASS.

DB test đã tạo và giữ lại để đối chiếu, không chứa dữ liệu import của người dùng:

- storagehub_schema_test_20261010_15425f5e: lần kiểm tra migration/FK ban đầu, 3 test PASS.
- storagehub_schema_test_20261010_eb5145b1: lần kiểm tra cuối, 4 test PASS, có fixture outbox test cô lập.

Không xóa hoặc reset bất kỳ database nào. Không lưu credential/token trong báo cáo.

## Chưa hoàn tất

- Ledger/communication vẫn OFF ở phiên BE dùng storagehub_local. Có migration đã test không đồng nghĩa module đã rollout.
- Chưa có policy BO thật được công bố cho cơ sở đang test; không tự đặt tỷ lệ cọc/cửa sổ gia hạn.
- Financial coverage từ tất cả writer, eligibility/cutoff, atomic hold và approval lifecycle vẫn thiếu implementation/guarantee cần thiết. Không tạo always-true provider để mở duyệt.
- Quyền Manager rentals:update chưa được grant; shared RBAC giữ nguyên.
- Chưa chứng nhận full E2E D2, mọi flow thành viên khác, browser UI E2E hoặc production.

Đây là bước hoàn tất naming và nền tảng schema/test, không phải tuyên bố đã hoàn tất tất cả dependency.
