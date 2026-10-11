# Rollout ledger và thông báo trên DB test local - 10/10/2026

> Kiểm tra tiếp theo lúc khoảng 23:16: BE/FE không kết nối được; kết quả HTTP/startup bên dưới là bằng chứng phiên rollout trước, không phải cam kết service hiện đang chạy. Helper xung đột gia hạn đã có 21 test mới nhưng chưa nối consumer/cấp grant/bật scheduler. Xem [báo cáo kiểm chứng](RENEWAL_OPERATIONAL_GUARD_VERIFICATION_20261010.md).

## Kết quả hiện tại

Đã sao lưu và áp dụng migration `2026101001` vào **storagehub_local** trong Docker, bật module ngày thuê, ledger và communication. BE khởi động thành công với **ddl-auto=validate**. API ledger của khách hàng, quản lý cơ sở và chủ doanh nghiệp đều trả HTTP 200, nhưng dữ liệu tài chính vẫn **UNKNOWN**, không phải số dư bằng 0.

Người dùng chọn **tự nhập policy trên trang BO**. Không công bố policy, tạo nghĩa vụ tài chính hoặc nhập khoản thu thay người dùng. Chưa chứng nhận D2 hay toàn bộ D1-D5 E2E thành công.

## Môi trường và sao lưu

- BE: `http://localhost:8080`; FE: `http://localhost:8443`.
- MySQL 8.4.11, container `storagehub-mysql`, cổng 3306, database `storagehub_local`. Không truy cập Render/TiDB hay production.
- Datasource trong log phiên đã chạy: `jdbc:mysql://localhost:3306/storagehub_local?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`.
- Backup trước migration: `C:\Users\ThinkPad X1\AppData\Local\Temp\storagehub-db-backups\storagehub_local_pre_ledger_20261010_224757_36ccef.sql`.
- Backup có 128575 byte, SHA256 `0F72583FBA8C03DE58B5D2ADEA9DDEBF54FFC4DC481155C7FAB1892ADCB1D013`; đã kiểm tra dòng kết thúc dump. Backup chứa dữ liệu riêng tư, không đưa vào Git.
- Không xóa/reset/restore dữ liệu, không dùng `create`/`update`, không sửa quyền hoặc writer của Booking/Payment/Return.

## Schema và khởi động thực tế

Flyway áp dụng một migration mới lúc 22:49:49 (giờ local), từ 12 lên **13 record thành công**, version cuối `2026101001`, mô tả `create rental ledger and notification outbox`. BE ghi `Started` lúc 22:50:12, không có lỗi validate/schema guard.

| Bảng mới | Kiểm tra thực tế |
|---|---|
| rental_ledger_accounts | Có, InnoDB |
| rental_ledger_obligations | Có, InnoDB |
| rental_ledger_receipts | Có, InnoDB |
| rental_ledger_allocations | Có, InnoDB |
| rental_ledger_refunds | Có, InnoDB |
| rental_ledger_commands | Có, InnoDB |
| notification_outbox | Có, InnoDB |

Đã đọc metadata FK/index: 9 liên kết tới bảng chung; có unique chống trùng source/evidence/decision/payout và command key, composite FK bảo vệ allocation, index due/received/dispatch/review. Migration chỉ tạo bảng mới; không ALTER/DROP bảng hiện hữu. FK RESTRICT có thể chặn xóa parent sau khi phát sinh ledger/outbox, vì vậy không tuyên bố mọi thao tác của flow khác đã được chứng nhận không ảnh hưởng.

Số dòng trước/sau rollout: rentals 1, reservations 1, payments 1, notifications 3. Rental hiện hữu giữ nguyên ngày 2026-10-10 đến ngày lưu 2027-01-10 và trạng thái ACTIVE. Ledger accounts và outbox vẫn 0 dòng; không backfill hay tạo dữ liệu để làm xanh test.

## API thật sau rollout

Rental kiểm tra: `1031d4d6-1b84-481f-a706-7e76bd368d69`. Facility: `89fe8d93-65be-4612-91c8-a3e805e56937`.

| Kiểm tra | Trạng thái | Bằng chứng |
|---|---|---|
| Customer ledger | PASS, HTTP 200 | UNKNOWN, tiền null; correlation `58fbbceb-9e60-45a7-9629-6f1c2fc635a2` |
| Manager ledger | PASS, HTTP 200 | UNKNOWN; correlation `3a10eac9-251f-4588-9719-844cbcb224c9` |
| Business ledger | PASS, HTTP 200 | UNKNOWN; correlation `c5de9997-c80b-4ce7-80d5-554c2d806aa8` |
| BO communication-policy/stored | EXPECTED_NOT_PUBLISHED, HTTP 404 | Policy has not been published; correlation `78d08cb5-3938-4f26-b7ed-31d0e71ce312` |
| BO renewal-policy/stored | EXPECTED_NOT_PUBLISHED, HTTP 404 | Policy has not been published; correlation `132ca9f9-6a71-4db1-9ae5-cd8409b0e5d9` |
| Customer rental-records | PASS, HTTP 200 | COMPLETE/EXCLUSIVE; lastPermittedDate 2027-01-09, endExclusive 2027-01-10; financialSummary UNKNOWN |
| Customer renewal-options | BLOCKED_POLICY, HTTP 409 | DEFERRED_SOURCE: BO renewal policy missing; correlation `ad05abbc-0486-497f-bc0f-3289ebb5894e` |
| Customer notification acknowledgement GET | PASS, HTTP 200 | UNTRACKED, acknowledgementAllowed=false, receivedAt=null; correlation `79c982d8-bf82-43cb-930a-262f356fafe9` |
| BO auth/me và facilities | PASS, HTTP 200 | policies:read và policies:update đều true; trả hai cơ sở hiện hữu |
| Swagger và FE policy URL | PASS, HTTP 200 | Routes module được đăng ký; FE trả SPA, không phải chứng nhận browser E2E |

Ledger trước rollout từng trả HTTP 500, nay trả 200. Không gửi POST acknowledgement hay tạo notification trong lượt rollout này. Không giả lập delivery hoặc xác nhận thông báo cũ là đã nhận.

## Nhập policy trên BO

1. Đăng xuất tài khoản Manager và đăng nhập BO `business@storagehub.demo` bằng tài khoản test đã có.
2. Mở **Chính sách gia hạn và hỗ trợ**, hoặc `http://localhost:8443/?page=rental-source-policies` sau khi đăng nhập BO.
3. Chọn **Kho Việt - Cơ sở Quận 1** cho rental đang kiểm tra.
4. Nhập và công bố policy **Gia hạn và quá hạn**, sau đó **Nhắc hạn và hỗ trợ**, theo giá trị nghiệp vụ thực tế. Không dùng giá trị đoán để vượt guard.
5. Đọc lại policy đã lưu và hiệu lực, rồi kiểm tra renewal-options lần nữa. Policy hợp lệ chưa đủ để khẳng định renewal thành công nếu coverage/hold/lifecycle hoặc quyền vẫn thiếu.

Đã xác minh menu/form/route từ source và quyền BO qua API. Chưa kiểm thử nhập/công bố policy bằng trình duyệt; người dùng chọn tự thao tác.

## Nguồn tài chính còn thiếu

Khoản Payment hiện có 6600000, purpose RESERVATION_DEPOSIT, status PAID nhưng gateway intent bắt đầu bằng **SIMULATED-**; source `SimulatedPaymentService` xác nhận đây là thanh toán mô phỏng. Không nhập nó vào ledger như khoản thu thật, không suy ra cọc hồ sơ thuê hay công nợ bằng 0.

`LedgerFinancialAdapters` đã đăng ký P01/P06/P14 khi bật module, nhưng cần `LedgerCoverageSource` chứng minh đầy đủ nghĩa vụ, khoản thu, cọc, hoàn tiền và tranh chấp, bao phủ các writer liên quan. Chưa tìm thấy runtime implementation cho nguồn coverage; `consistentThroughApproval()` mặc định false. Vì vậy trạng thái **BLOCKED_COVERAGE** vẫn đúng. Policy BO, protocol hold/cross-writer và lifecycle/access không được thay thế bằng dữ liệu giả.

## Khởi động lại đúng cấu hình

Phiên hiện tại đã chạy với overlay bật ba module và cả hai Flyway locations. `run-dev.ps1` một mình trong terminal mới không giữ overlay đó. Đã thêm runner opt-in, cố định DB test local:

```powershell
cd D:\semester-5\SWP\self-storage-be
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-rental-support-dev.ps1
```

FE vẫn dùng:

```powershell
cd D:\semester-5\SWP\self-storage-fe
npm run dev
```

Không chạy thêm BE nếu cổng 8080 đã có phiên đang hoạt động. Runner giữ validate, clean-disabled=true, baseline-on-migrate=false, thêm location integration; từ chối ghi đè SPRING_APPLICATION_JSON đã có. Không chứa thông tin đăng nhập mới; dùng runner local hiện có.

## Kiểm thử và giới hạn bằng chứng

- **PASS trong lượt này:** live startup/validate/Flyway, metadata SQL, các GET API thật ở bảng trên; parser PowerShell 0 lỗi và guard từ chối config đã có của runner mới.
- **Chưa chạy runner mới end-to-end:** cấu hình tương đương đã được chạy và xác minh trong phiên BE hiện tại; tránh khởi động thêm hoặc gián đoạn lúc người dùng nhập policy.
- **Hồi quy từ lượt trước, không chạy lại trong rollout:** 139 test BE và 136 test FE PASS; chi tiết tại `RENTAL_LEDGER_SCHEMA_IMPLEMENTATION_20261010.md`.
- Không chạy full browser E2E, không có screenshot mới, không chứng nhận happy-path ghi tài chính trên storagehub_local. Test ghi/đọc ledger/outbox trước đó chạy trên DB test cô lập, không thay thế bằng chứng API mutation live.
- Baseline FE typecheck còn 8 lỗi ngoài phạm vi đã ghi nhận trước đó; không chỉnh source/test của teammate để làm xanh.
- File mới lượt rollout: BE `run-rental-support-dev.ps1`, báo cáo này và ghi chú lịch sử ở bốn báo cáo FE. Không sửa thêm source nghiệp vụ/HTTP/security. Giữ nguyên dirty worktree, không commit/push.
