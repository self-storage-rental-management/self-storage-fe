# Ledger/outbox vào Flyway chung

Ngày: 11/10/2026, Asia/Saigon. Người dùng đã duyệt đưa 7 bảng vào db/migration để BE tự phát hiện khi khởi động. **Chưa chạy trên DB chung của team, chưa commit/push.**

## Thay đổi

- Chuyển nguyên `V2026101001__create_rental_ledger_and_notification_outbox.sql` từ BE `src/main/resources/db/integration-migration` vào `src/main/resources/db/migration`. Version/script/nội dung giữ nguyên; không giữ bản SQL trùng tại location cũ.
- SHA256 trước/sau: `0E7AD29986D1CFB6E5E5DD3380CC464067EF16E83A13A52B3D0EAF370426766F`; checksum Flyway trước/sau: `-1198625055`. Comment opt-in trong SQL là lịch sử, giữ nguyên để không sửa checksum.
- Thêm `src/main/java/com/storagehub/config/LedgerMigrationSafetyCallback.java`, bean Callback tự đăng ký với Flyway. Chỉ xử lý BEFORE_EACH_MIGRATE của version 2026101001; không can thiệp Payment hoặc migration khác. Kiểm MySQL 8.4/connection thật, bảng trùng trước DDL ledger; không repair/reset hoặc close connection của Flyway.
- Profile `application-rental-support-schema.properties` và test dùng db/migration + db/paymentmigration. Payment vẫn opt-in; không tự thêm Java migration vào default/staging/prod.
- Thêm test `LedgerMigrationSafetyCallbackTests`, `LedgerDefaultMigrationMySqlTests`, `LedgerMigrationRelocationMySqlTests`; cập nhật `RentalSupportSchemaRolloutTests`, `RentalIntegrationMySqlSchemaTests`.
- Đồng bộ BE changelog, contract ledger/communication, hướng dẫn rollout/Payment và README location cũ. Javadoc rollout ghi rõ ledger không còn opt-in.

Không thay flags nghiệp vụ, writer/Entity, HTTP/DTO, quyền, default/staging/prod properties, ddl-auto, seed script hoặc FE runtime. Worktree có nhiều thay đổi từ trước được giữ nguyên. SQL chỉ CREATE 6 bảng rental_ledger_* + notification_outbox, không ALTER/DROP/seed tiền hoặc grant. Callback không tự bật module.

## Kiểm thử

| Kiểm tra | Kết quả / bằng chứng |
| --- | --- |
| Callback scope/engine | PASS: 2 tests. Chỉ version ledger trước migrate; TiDB chưa kiểm chứng bị chặn, không execute DDL hoặc close connection Flyway. |
| Profile safety | PASS: 7 tests; locations mới, guard datasource/engine và validate/seed/flags được giữ. |
| Default-only MySQL | PASS: 3 tests. Chỉ db/migration tạo 13 migration thành công và đủ 7 bảng, không chạy Payment; upgrade từ 12 migration giữ dữ liệu User; replay không trùng history; bảng ledger có sẵn không có history bị chặn trước CREATE các bảng ledger khác. |
| History từ location cũ | PASS: 1 test trên DB test đã áp dụng trước khi chuyển source; checksum không đổi, validate PASS, pending rỗng, replay không tăng số history. |
| Full MySQL/JDBC guards | PASS: 6 tests; common + Payment opt-in, FK/readback/retry/history/schema constraints. |
| Ledger/outbox JDBC regression | PASS: 27 + 14 tests. |
| Tổng | **60 tests, failures/errors/skipped = 0; BUILD SUCCESS, exit 0**, 56.499 giây. |
| Diff/hash | PASS: FE/BE `git diff --check`, hash SQL không đổi. Có cảnh báo LF/CRLF ở worktree hiện có; không sửa unrelated files. |
| Spring Boot đăng ký callback | STATIC VERIFIED: đối chiếu bytecode Spring Boot Flyway 4.1.1 trong local Maven: FlywayConfiguration nhận ObjectProvider<Callback>, gọi configureCallbacks/FluentConfiguration.callbacks với các bean. Component trong package com.storagehub.config được scan; test Flyway dùng callback thực. Không nhận đây là một lần full BE startup mới. |
| BE startup/browser E2E/TiDB/shared DB | NOT RUN / BLOCKED_TARGET trong lượt này. Không suy toàn bộ flow team hoặc Hibernate validate trên DB đích từ các schema tests. |

Lệnh BE (credentials và URL test cấp qua environment, không ghi secret trong Git):

```powershell
.\mvnw.cmd '-Dtest=LedgerMigrationSafetyCallbackTests,RentalSupportSchemaRolloutTests,RentalIntegrationMySqlSchemaTests,LedgerDefaultMigrationMySqlTests,LedgerMigrationRelocationMySqlTests,LedgerStoreJdbcTests,NotificationOutboxJdbcTests' test
```

DB test mới `storagehub_schema_test_common_9a98a9ce`; ba DB case default:

- `storagehub_schema_test_ledger_71b27f3099f14091adef72f241254560`
- `storagehub_schema_test_ledger_2d515a9af9104c2a969009ff5d459c7f`
- `storagehub_schema_test_ledger_120d9a5a442f47fd84bf43d63b2c2a67`

Relocation chỉ dùng DB test trước đó `storagehub_schema_test_payment_full_b45468d5`, assert pending rỗng trước replay. Tất cả URL được test giới hạn localhost/127.0.0.1 và storagehub_schema_test_*; không dùng storagehub_local/shared. Các DB giữ lại, không clean/drop/reset. Case collision cố tình có failed migration để kiểm fail-closed; không sử dụng fixture đó làm môi trường rollout.

Đã bỏ đúng một bản SQL **build artifact** cũ ở `target/classes/db/integration-migration` sau khi kiểm hash, để Maven không giữ version trùng khi đổi source path. Không xóa dữ liệu/backup/user source; artifact tái tạo từ source nếu build lại.

## Deployment

BE với Flyway enabled và default location db/migration sẽ phát hiện ledger khi startup, không cần seed-mysql.bat hoặc location ledger riêng. Nếu migration đã applied, Flyway chỉ validate/no-op; không sửa checksum/history để tạo lại.

TiDB hoặc engine/version chưa chứng nhận: callback dừng **trước DDL ledger**, không cố chạy. Những migration nền pending trước ledger có thể đã chạy trước callback, nên backup và thử bản sao DB chung vẫn cần thiết. FK RESTRICT có thể tác động xóa/lưu trữ khi đã có ledger/outbox, chưa chứng nhận mọi flow team. Không báo deployment TiDB/shared PASS.

Nếu DB đã applied Payment Java migration thì tiếp tục giữ db/paymentmigration và class tương ứng để resolve history. Ledger/communication vẫn giữ flag hiện hữu, mặc định tắt; thiếu coverage/policy/hold/lifecycle/delivery vẫn bị chặn. Không tạo số dư 0 hoặc chứng cứ tiền thật từ schema rỗng.
