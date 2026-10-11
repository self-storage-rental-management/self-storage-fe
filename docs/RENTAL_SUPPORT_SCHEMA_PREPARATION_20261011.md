# Chuẩn bị rollout schema hồ sơ thuê và hỗ trợ

Ngày kiểm chứng: 11/10/2026 (Asia/Saigon).

Cập nhật mới nhất: đã duyệt chuyển ledger 2026101001 vào db/migration; các mô tả ledger opt-in/location cũ dưới đây là baseline lịch sử. Profile hiện dùng db/migration + db/paymentmigration (Payment vẫn opt-in). Xem [LEDGER_COMMON_MIGRATION_REPORT_20261011.md](LEDGER_COMMON_MIGRATION_REPORT_20261011.md): 60 tests PASS, version/checksum giữ nguyên; chưa trực tiếp chạy DB chung.

## Kết luận

Đã đăng ký/document migration 7 bảng trong changelog BE và bổ sung profile rollout có kiểm tra DB đích. **Chưa cập nhật DB chung của team.** Migration chỉ được thực thi trong lượt này trên DB MySQL test mới, độc lập; không chạy lại trên `storagehub_local` hoặc datasource shared/prod.

Merge code không tự kích hoạt profile mới. Việc triển khai DB chung cần xác minh datasource/engine, backup và kiểm thử bản sao dữ liệu chung.

Cập nhật kiểm thử startup 11/10/2026, 08:51 (Asia/Saigon): **BE không khởi động được trên schema test được tạo chỉ bằng Flyway**. Flyway/7 bảng integration PASS, nhưng Hibernate `validate` phát hiện thiếu `payments.gateway_intent_id`. Đây là dependency schema Payment nền tảng chưa được migration hiện tại đáp ứng; chưa thể kiểm thử API runtime hoặc xác nhận đủ điều kiện rollout ứng dụng.

Cập nhật sau khi được duyệt bổ sung Payment: migration opt-in 2026101101 đã xử lý lỗi trên DB test mới; BE startup `validate` PASS lúc 08:59:38. Những dòng FAIL bên dưới là baseline trước bổ sung, không phải kết quả hiện tại trên DB mới. Xem [PAYMENT_GATEWAY_MIGRATION_REPORT_20261011.md](PAYMENT_GATEWAY_MIGRATION_REPORT_20261011.md). Shared DB/TiDB/full E2E vẫn chưa chứng nhận. Profile mới hiện cần đủ ba locations (thêm db/paymentmigration).

## File của lượt chuẩn bị này

Các đường dẫn dưới đây thuộc repo `self-storage-be`, trừ báo cáo này:

| File | Thay đổi |
| --- | --- |
| `docs/DATABASE_CHANGELOG.md` | Thêm mục 11/10 cho 7 bảng, trạng thái local/shared và điều kiện rollout; giữ thay đổi đang có của người dùng. |
| `docs/RENTAL_SUPPORT_SCHEMA_ROLLOUT.md` | Hướng dẫn preflight, cấu hình, rollout, hậu kiểm và xử lý lỗi. |
| `src/main/resources/application-rental-support-schema.properties` | Profile opt-in: datasource bắt buộc, cả hai Flyway locations, `ddl-auto=validate`, cấm clean/baseline tự động, tắt seed/backfill và module nghiệp vụ. |
| `src/main/java/com/storagehub/config/RentalSupportSchemaRolloutConfiguration.java` | Kiểm tra connection thật trước migrate: tên DB chính xác, MySQL 8.4 đã kiểm chứng; chặn engine khác và bảng integration/lịch sử không nhất quán; hậu kiểm hai schema guard. |
| `src/main/resources/db/integration-migration/README.md` | Tài liệu profile mới, không thay SQL migration. |
| `src/test/java/com/storagehub/config/RentalSupportSchemaRolloutTests.java` | 7 test cấu hình và từ chối DB/engine/identity không phù hợp. |
| `src/test/java/com/storagehub/service/ledger/RentalIntegrationMySqlSchemaTests.java` | Chạy migration qua strategy trên DB test rỗng; thêm kiểm tra replay không tạo lịch sử trùng. |

Không sửa cấu hình mặc định/staging/prod, shared security, quyền, endpoint, writer Booking/Payment/Return, ngày thuê hoặc tiền. Các thay đổi có sẵn khác trong worktree FE/BE được giữ nguyên, không gộp vào kết luận của lượt này. Chưa commit/push.

## Bằng chứng kiểm thử

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| Unit/profile + JDBC/communication regression | PASS | `RentalSupportSchemaRolloutTests` 7, `LedgerStoreJdbcTests` 27, `NotificationOutboxJdbcTests` 14, `CommunicationPersistenceIntegrationTests` 15: tổng 63, failures/errors/skipped = 0, BUILD SUCCESS. |
| MySQL migration/schema/readback/retry | PASS | `RentalIntegrationMySqlSchemaTests`: 5, failures/errors/skipped = 0. Migration thật qua strategy; Flyway validate, 7 bảng, 9 FK nối bảng chung, guard đọc cột, từ chối UUID cha không tồn tại, outbox ghi/đọc/retry/inbox/ack và replay migration. |
| SQL đọc độc lập sau test | PASS | `VERSION()` = `8.4.11`; `DATABASE()` = `storagehub_schema_test_20261011_d2b45319`; 7 bảng integration; Flyway version `2026101001`, success = 1. |
| Checksum SQL trước/sau | PASS | SHA256 không đổi: `0E7AD29986D1CFB6E5E5DD3380CC464067EF16E83A13A52B3D0EAF370426766F`. |
| `git diff --check` FE và BE | PASS | Không lỗi whitespace; có cảnh báo chuyển LF/CRLF ở các file đang thay đổi từ trước. |
| Khởi động toàn bộ BE bằng profile rollout mới/Hibernate validate | FAIL | Lượt tiếp tục lúc 08:51: active profile `rental-support-schema`, đúng DB test, cổng 8082; Flyway validated 13 migrations, no migration necessary; Hibernate báo `Schema validation: missing column [gateway_intent_id] in table [payments]`, process exit 1. |
| API runtime ledger/thông báo | BLOCKED_STARTUP | Không gọi API hoặc bật module sau lỗi startup. Không coi Tomcat initialized là ứng dụng đã sẵn sàng. |
| TiDB / DB chung / toàn bộ flow team | BLOCKED_TARGET | Chưa có connection đích và bản sao dữ liệu để chứng nhận. `application-prod.properties` dùng `TiDbMySqlDialect`, không suy engine thực tế chỉ từ cấu hình hay prefix JDBC. |
| Browser E2E / FE build | NOT RUN | Không thay FE runtime trong lượt chuẩn bị schema; không nhận các kiểm thử cũ là kết quả lượt này. |

Lệnh regression đã chạy từ repo BE:

```powershell
.\mvnw.cmd '-Dtest=RentalSupportSchemaRolloutTests,LedgerStoreJdbcTests,NotificationOutboxJdbcTests,CommunicationPersistenceIntegrationTests' test '-Dspring.datasource.url=jdbc:h2:mem:storagehub;MODE=MySQL;DB_CLOSE_DELAY=-1' '-Dspring.datasource.driver-class-name=org.h2.Driver' '-Dspring.datasource.username=sa' '-Dspring.datasource.password=' '-Dspring.flyway.enabled=false' '-Dlogging.level.root=WARN' '-Dspring.jpa.show-sql=false'
```

Test MySQL chạy với `STORAGEHUB_SCHEMA_TEST_URL` trỏ **localhost:3306/storagehub_schema_test_20261011_d2b45319** và credential cấp ngoài Git:

```powershell
.\mvnw.cmd '-Dtest=RentalIntegrationMySqlSchemaTests' test
```

DB test được tạo mới trước lệnh; test từ chối schema không rỗng và không nhận URL DB chung. DB test được giữ lại để đối chiếu, không xóa/reset. Không chạy lại test fresh-schema trên DB này; lần mới cần DB test rỗng khác. Test dùng fixture riêng, không tạo bằng chứng tài chính cho hồ sơ thật.

Lưu ý: MySQL test cấu hình `outOfOrder(true)` từ test harness hiện hữu; profile deployment mới đặt `out-of-order=false`. Replay test không thay thế kiểm tra lịch sử/version của bản sao DB đích.

## Lỗi startup nền tảng và hướng xử lý

Luồng kiểm chứng: cấu hình rollout → connection DB test → Flyway → schema guard ledger/outbox → Hibernate validate → API. Dừng tại Hibernate, theo stop condition của skill `verification`; không tiếp tục qua boundary hỏng để ghi nhận API/E2E PASS.

- Log: `C:\Users\ThinkPad X1\AppData\Local\Temp\storagehub-schema-startup-20261011.log`.
- Flyway: `Successfully validated 13 migrations`; `Schema ... is up to date. No migration necessary`.
- Lỗi đầu tiên: `Schema validation: missing column [gateway_intent_id] in table [payments]`.
- `self-storage-be/src/main/java/com/storagehub/domain/model/Payment.java:50` khai báo `@Column(nullable = false, unique = true, length = 100)` cho `gatewayIntentId`. Không có diff của file này trong lượt kiểm thử. Commit gần nhất của file: `6cf6710 fix: persist simulated payment gateway intent`.
- Migration nền `V2026100200__create_initial_schema.sql:440` tạo `payments` nhưng không có cột này; tìm trong các migration hiện tại không có `gateway_intent_id`.
- SQL hậu kiểm đúng DB test: 13 migration, 0 failed, 7 bảng integration, 0 rentals; query cột `gateway_intent_id` không trả dòng. BE test đã thoát, không giữ server 8082.

Trạng thái **BLOCKED_EXTERNAL_SCHEMA**. Owner đề xuất: người phụ trách Payment + database; chưa xác nhận cá nhân. Cần migration bổ sung có version mới, phù hợp yêu cầu VARCHAR(100)/NOT NULL/UNIQUE của Entity, cùng phương án dữ liệu Payment cũ được kiểm chứng. Không sửa migration cũ hoặc tự tạo gateway/payment evidence giả để backfill. Nếu Entity không còn đúng contract hiện hành thì owner cần chốt lại mapping/writer thay vì thêm cột chỉ để vượt validate.

Không đổi sang `create`/`update`, không tắt Hibernate validate, không ALTER bảng Payment, không sửa writer/role và không truy cập DB chung để vượt lỗi. Sau khi dependency được xử lý, chạy lại startup trên DB test/bản sao, rồi mới kiểm API khi module được bật có kiểm soát. Một lỗi đầu tiên không chứng minh đây là toàn bộ các thiếu hụt schema.

## Điều kiện còn lại trước DB chung

1. Xác minh `SELECT VERSION(), DATABASE()` trên đúng connection deployment; không công bố credential vào chat/Git. Guard hiện chỉ chứng nhận MySQL 8.4, không có nghĩa engine khác chắc chắn không tương thích.
2. Backup, thử phục hồi và migration trên bản sao dữ liệu chung; kiểm tra checksum/history/schema trùng tên. Không clean/repair/baseline để vượt lỗi.
3. Kiểm thử tác động FK RESTRICT tới flow xóa/lưu trữ của team, full BE startup với `validate`, và regression các flow liên quan. Chưa có bằng chứng đủ để cam kết không ảnh hưởng mọi flow.
4. Nếu là TiDB, giữ chặn và kiểm chứng SQL tương thích trên bản sao TiDB trước; không bỏ guard hoặc sửa SQL đã áp dụng để ép chạy.
5. Sau rollout giữ cả hai Flyway locations trong cấu hình deployment để validate lịch sử. Ledger/communication vẫn tắt cho tới khi nguồn/policy và vận hành được kiểm chứng; không diễn giải thiếu nguồn thành số dư 0 hay thanh toán thành công.

Hướng dẫn triển khai chi tiết: `self-storage-be/docs/RENTAL_SUPPORT_SCHEMA_ROLLOUT.md`.
