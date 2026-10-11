# Bổ sung migration Payment và dữ liệu legacy

Ngày kiểm chứng: 11/10/2026, Asia/Saigon.

Cập nhật location sau lượt này: ledger đã chuyển vào Flyway chung db/migration theo phê duyệt, profile hiện chỉ cần db/migration + db/paymentmigration. Những mô tả ba locations bên dưới là lịch sử trước chuyển vị trí; Payment vẫn opt-in. Xem [LEDGER_COMMON_MIGRATION_REPORT_20261011.md](LEDGER_COMMON_MIGRATION_REPORT_20261011.md).

## Kết quả

Đã thêm migration opt-in `2026101101` cho `payments.gateway_intent_id`. BE khởi động thành công với `ddl-auto=validate` trên **DB test mới**; lỗi startup thiếu cột trước đó đã được xử lý ở môi trường này. Chưa cập nhật `storagehub_local` hoặc DB chung, chưa commit/push.

Migration giữ mã hiện có. NULL/blank nhận `LEGACY-UNVERIFIED-<hex ID>`: định danh kỹ thuật chưa xác minh, không phải chứng cứ thanh toán thật/simulation. Không thay số tiền, trạng thái, ngày thanh toán, key chống trùng, revision, writer/Entity hoặc quyền. Không chạy/sửa `seed-mysql.bat`.

## Thay đổi trong lượt này

Các đường dẫn dưới đây thuộc repo BE, trừ báo cáo FE:

| File | Lý do |
| --- | --- |
| `src/main/java/db/paymentmigration/V2026101101__add_payment_gateway_intent_id.java` | Preflight MySQL 8.4/BINARY(16), schema/index/collision; bổ sung VARCHAR(100), backfill marker thiếu, enforce NOT NULL/UNIQUE; giữ giá trị và charset/collation hiện có. |
| `src/main/resources/application-rental-support-schema.properties` | Thêm location opt-in `classpath:db/paymentmigration`; giữ `validate`, seed/module tắt. |
| `src/test/java/com/storagehub/service/ledger/PaymentGatewayMigrationMySqlTests.java` | 8 ca migration thật trên schema fixture riêng, không reset/xóa DB. |
| `src/test/java/com/storagehub/service/ledger/RentalIntegrationMySqlSchemaTests.java` | Thêm location và ca hậu kiểm cột/index/history Payment; giữ test ledger/outbox cũ. |
| `src/test/java/com/storagehub/config/RentalSupportSchemaRolloutTests.java` | Assertion đủ ba locations, không yếu hóa guard/cấu hình. |
| `src/test/java/com/storagehub/service/rental/RentalBookingEvidenceJpaTests.java` | Assertion marker legacy vẫn UNVERIFIED, giữ PAID chỉ là status đã lưu, không expose raw reference. |
| `docs/PAYMENT_GATEWAY_MIGRATION.md` | Quy tắc dữ liệu cũ, failure, giới hạn engine/checksum/deployment. |
| `docs/DATABASE_CHANGELOG.md`, `docs/RENTAL_SUPPORT_SCHEMA_ROLLOUT.md`, `docs/LEDGER_COMMUNICATION_INTEGRATION_API_CONTRACT.md`, migration README | Đăng ký thay đổi và đồng bộ hướng dẫn, sửa ghi chú rollout local/shared không chính xác. |
| Báo cáo này và `docs/RENTAL_SUPPORT_SCHEMA_PREPARATION_20261011.md` ở FE | Ghi bằng chứng mới, phân biệt baseline FAIL với startup PASS sau migration. |

Default/staging/prod, `Payment.java`, `SimulatedPaymentService.java`, migration SQL đã có và seed script không có diff của lượt này. Worktree trước đó đã có nhiều thay đổi; giữ nguyên các thay đổi đó. Không sửa FE runtime/giao diện.

## Kiểm thử và bằng chứng

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| Payment migration MySQL | PASS | 8 tests, failures/errors/skipped=0: thiếu cột và Payment cũ; nullable/blank; mã có sẵn và index Hibernate; charset/collation; duplicate; length mismatch; index name collision; collision giữa marker dự kiến và reference đang có. Positive cases kiểm replay/history; negative cases giữ dữ liệu, không ALTER/UPDATE qua preflight lỗi. |
| Full MySQL schema/ledger/outbox | PASS | 6 tests, failures/errors/skipped=0; đủ migration Payment + ledger/outbox, schema guards, FK, readback/retry và replay không tạo history trùng. |
| Profile + writer simulation | PASS | 7 `RentalSupportSchemaRolloutTests` + 4 `SimulatedPaymentServiceTests`; lần chạy lại 11 tests, BUILD SUCCESS, exit 0. |
| Reader legacy/ownership/absence | PASS | `RentalBookingEvidenceJpaTests`: 8 tests, failures/errors/skipped=0, BUILD SUCCESS, exit 0. Marker legacy vẫn UNVERIFIED, không expose raw gateway ID; ownership/missing-data/simulation assertions được giữ. Chỉ H2 test, không dùng DB shared. |
| Full BE startup `validate` | PASS | Profile `rental-support-schema`, datasource test cố định; Flyway validated 14 migrations; JPA EntityManagerFactory initialized; Started StoragehubApplication lúc 08:59:38, 16.419s. Seed/admin/backfill/mail và ledger/communication đều tắt. |
| HTTP readiness cơ bản | PASS | `GET http://127.0.0.1:8082/v3/api-docs` → 200, title StorageHub API; protected ledger request không Bearer → 401. Không phải test business API có đăng nhập. |
| Shared DB/TiDB/full browser E2E | NOT RUN / BLOCKED_TARGET | Chưa có connection đích/bản sao; không bật module để coi nguồn thiếu là đủ. Không có screenshot hoặc kiểm thử browser trong lượt này. |

Tổng 33 ca riêng biệt PASS (14 MySQL + 11 profile/writer + 8 JPA reader), không đếm các lần chạy lại. `git diff --check` FE/BE PASS; chỉ có cảnh báo LF/CRLF từ worktree hiện có, không sửa unrelated files để loại cảnh báo.

Lệnh MySQL đã chạy từ BE, với URL localhost:3306 tới DB test mới và credential ngoài Git:

```powershell
.\mvnw.cmd '-Dtest=RentalSupportSchemaRolloutTests,SimulatedPaymentServiceTests,RentalIntegrationMySqlSchemaTests,PaymentGatewayMigrationMySqlTests' test
```

Bốn Surefire reports ghi 25 ca PASS. PowerShell launcher lần đầu exit 1 vì `$ErrorActionPreference=Stop` coi cảnh báo Mockito trên stderr là lỗi; **không coi exit này là BUILD SUCCESS**. Unit/profile/writer đã được chạy lại với runner không chặn stderr: 11 ca PASS, BUILD SUCCESS. Không rerun fresh-schema test trên DB đã có dữ liệu; bằng chứng MySQL là reports và SQL hậu kiểm.

Lệnh reader với DB H2 cô lập:

```powershell
.\mvnw.cmd '-Dtest=RentalBookingEvidenceJpaTests' test '-Dspring.datasource.url=jdbc:h2:mem:payment_legacy_test;MODE=MySQL;DB_CLOSE_DELAY=-1' '-Dspring.datasource.driver-class-name=org.h2.Driver' '-Dspring.datasource.username=sa' '-Dspring.datasource.password=' '-Dspring.flyway.enabled=false' '-Dlogging.level.root=WARN' '-Dspring.jpa.show-sql=false'
```

## Database test và startup

Full schema: `storagehub_schema_test_payment_full_b45468d5`, MySQL 8.4.11. SQL hậu kiểm: migration `2026101001` (SQL) success=1, `2026101101` (JDBC) success=1; gateway column varchar(100), nullable=NO, đúng một unique index; rentals=0. Không phải bản sao dữ liệu chung.

8 schema Payment tối giản được test tạo và giữ lại:

- `storagehub_schema_test_payment_10beeaf8d9a74f7bbf0b695c4a6c581c`
- `storagehub_schema_test_payment_66032c5939cd4195aecdd54f7a1e8e7b`
- `storagehub_schema_test_payment_76b5d942d2d54002800c280ba40ff61d`
- `storagehub_schema_test_payment_dee6179e0dea459a9a90095c5ef7fcdb`
- `storagehub_schema_test_payment_d01a4f2db04d471e83ecca455231ff5a`
- `storagehub_schema_test_payment_6ec97306cf58421bba520ec30ed7a865`
- `storagehub_schema_test_payment_bcbe4fc8a8424e079fce7e30d33904e4`
- `storagehub_schema_test_payment_f31055773da149689a13d38cfa42c409`

Negative-case schema có Flyway failed history do test chủ động tạo tình huống lỗi; không dùng các fixture này làm môi trường rollout. Baseline=0 chỉ dành cho bảng fixture do test tự tạo, không bật baseline deployment.

Log startup: `C:\Users\ThinkPad X1\AppData\Local\Temp\storagehub-payment-schema-startup-20261011.log`. Server test cổng 8082 đã được dừng sau HTTP checks. Không kill server của người dùng.

SHA256 source migration mới: `83E32261C74BA924CB3102DBA3ED6B9AF75B8BEE981D30BE4F81A7E9ED91AAC1`. Flyway Java migration dùng checksum mặc định null, không tuyên bố checksum source này được Flyway tự validate. SQL ledger cũ giữ SHA256 `0E7AD29986D1CFB6E5E5DD3380CC464067EF16E83A13A52B3D0EAF370426766F`.

## Trước khi cập nhật DB chung

Xác minh engine/datasource, backup và thử bản sao dữ liệu chung. Collision hoặc schema lạ phải được đối chiếu, không ép truncate/repair/reset. Giữ đủ ba locations và class migration sau deployment. Test Payment tối giản và full schema rỗng không chứng minh toàn bộ dữ liệu/lifecycle/trigger của team tương thích.

Skill `verification` được dùng để kiểm từng boundary: schema → Hibernate → HTTP readiness. Không nâng kết quả này thành full E2E hoặc dữ liệu tài chính đã đủ; policy/coverage/hold/lifecycle/delivery còn thiếu vẫn bị chặn.
