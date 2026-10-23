# Kiểm thử luồng D1–D2 trên môi trường local

> Cập nhật phiên 22:50: migration ledger/outbox đã áp dụng và module đã bật, giữ validate. Xem [báo cáo rollout](RENTAL_LEDGER_LOCAL_ROLLOUT_20261010.md) cùng runner opt-in cho lần khởi động tiếp theo. Bằng chứng luồng 21:28–21:38 bên dưới được giữ nguyên như lịch sử; chưa chứng nhận toàn bộ D2 E2E thành công.

Thời điểm: 10/10/2026, khoảng 21:28–21:38, múi giờ Asia/Ho_Chi_Minh.

## 1. Môi trường thực sự đã chạy

Đối chiếu `D:\semester-5\SWP\docs\update.md` và dùng đúng hai lệnh người dùng yêu cầu:

```powershell
cd D:\semester-5\SWP\self-storage-be
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-dev.ps1
```

Trong `D:\semester-5\SWP\self-storage-fe`:

```powershell
npm run dev
```

- BE: `http://localhost:8080`, Tomcat khởi động thành công.
- FE: `http://localhost:8443`, GET `/` trả HTTP 200, có Vite client và entry ứng dụng.
- FE `.env`: `VITE_API_BASE_URL=http://localhost:8080`.
- MySQL: Docker container `storagehub-mysql`, schema `storagehub_local`; không dùng `storagehub_duong_test`, Render hoặc TiDB.
- Ban đầu: 2 cơ sở, 40 gian kho, 0 Rental, 0 Reservation.
- Lịch sử Flyway đọc được 12 migration thành công, đến `2026100909`.
- Tài khoản Customer, Staff, Manager trong tài liệu đều đăng nhập HTTP 200; JWT có đúng role và scope cơ sở Quận 1. Không thay đổi quyền của tài khoản.

Đây là kiểm thử tích hợp qua HTTP thực tế và đối chiếu DB. Chưa xác minh E2E thao tác trên giao diện: công cụ trình duyệt trả danh sách trình duyệt rỗng; mở `iab` và `chrome` đều báo không khả dụng. Không có ảnh chụp màn hình hoặc bằng chứng click UI trong lượt này.

## 2. Fixture tạo qua flow, không chèn Rental bằng SQL

- Cơ sở: `HCM-Q1-F01`, Kho Việt – Cơ sở Quận 1.
- Gian: `HCM-Q1-F01-S-002`.
- Gói lấy từ API/DB: `DEMO_3M`, 3 tháng, `policyVersion=demo-v1`.
- Kỳ thuê: `2026-10-10` đến `2027-01-10`, theo convention Booking `[startDate, endDate)`.
- Reservation: `96a8b3e1-afa7-43f4-b445-33306c954cd3`.
- Mã đặt chỗ: `RSV-33608B4F6402`.
- Rental: `1031d4d6-1b84-481f-a706-7e76bd368d69`.
- Check-in: `6b4adc61-7a0e-4f32-a0fd-868f4c9adf8b`.

Gói ngắn nhất API cung cấp là 3 tháng. Không tự tạo gói 1 tháng, đổi ngày hệ thống, backfill ngày hoặc sửa policy để ép điều kiện gia hạn.

**Thanh toán là mô phỏng local, không thu tiền thật.** Hàng hóa, checklist bàn giao và ảnh PNG nhỏ upload qua `/api/files` là fixture kiểm thử, không phải bằng chứng bàn giao vật lý hoặc xác nhận đã thu đủ nghĩa vụ tài chính. Các ghi chú và tên ảnh ghi rõ đây là kiểm thử local.

| Bước | API thực tế | Kết quả |
|---|---|---|
| Discovery và gói thuê | GET `/api/facilities`, unit-types, rental-packages | PASS, HTTP 200, dữ liệu DB |
| Kiểm tra hàng | POST `/api/customer/reservations/compatibility-check` | PASS, HTTP 200, COMPATIBLE |
| Báo giá Booking | POST `/api/customer/reservations/quote` | PASS, HTTP 200, quote lưu thật |
| Tạo đặt chỗ | POST `/api/customer/reservations`, Idempotency-Key | PASS, HTTP 200, AWAITING_EMAIL |
| Lấy mã phát triển và xác minh | POST email-verification/resend, email-verification | PASS, HTTP 200, AWAITING_PAYMENT |
| Thanh toán mô phỏng | POST simulated-payment, Idempotency-Key | PASS, HTTP 200, CONFIRMED |
| Manager phân gian | GET available-units, POST `/api/manager/unit-assignments/{reservationId}` | PASS, HTTP 200, UNIT_RESERVED |
| Staff lên lịch | POST `/api/staff/check-ins/reservations/{reservationId}/schedule` | PASS, HTTP 200, READY_FOR_CHECKIN |
| Upload fixture | POST `/api/files`, multipart CHECK_IN | PASS, HTTP 200, file gắn đúng check-in |
| Staff hoàn tất bàn giao | POST `/api/staff/check-ins/{checkInId}/complete` | PASS, HTTP 200, AWAITING_CUSTOMER_RECEIPT |
| Customer xác nhận | POST `/api/customer/reservations/{reservationId}/receipt-confirmation` | PASS, HTTP 200, COMPLETED; Rental active |

Correlation ID xác nhận nhận kho: `3b590b87-dfba-46a5-822f-b33619be265d`.

## 3. D1: phần đọc cơ bản PASS, nguồn bổ sung chưa đầy đủ

| Kiểm tra | Kết quả |
|---|---|
| Customer GET `/api/customer/rental-records?size=10` và detail | PASS, HTTP 200, đúng Rental vừa tạo |
| Manager GET `/api/manager/rentals?size=10` và detail | PASS, HTTP 200, cùng Rental |
| Khách hàng, gian kho, ngày và giá tháng khớp flow Booking | PASS, `5.500.000 VND/tháng`, đúng kỳ thuê |
| Lọc active và tìm mã gian | PASS, HTTP 200, 1 hồ sơ |
| Lọc completed | PASS, HTTP 200, 0 hồ sơ |
| Lọc `endTo=2026-10-10` | PASS, HTTP 200, 0 hồ sơ |
| Lọc đúng ngày cuối đã lưu `2027-01-10` | PASS, HTTP 200, 1 hồ sơ |
| size=0 | PASS guard, HTTP 400 |
| Manager lọc cơ sở Bình Dương ngoài scope | PASS guard, HTTP 403 |
| Không JWT | PASS guard, HTTP 401 |
| Detail không tồn tại | PASS guard, HTTP 404; không thay thế được test khác Customer |
| Manager gọi route Customer | PASS guard, HTTP 403 |
| Gọi lại receipt-confirmation | PASS, HTTP 200; DB vẫn chỉ có 1 Rental |
| Gọi lại simulated-payment cùng key | PASS, HTTP 200, cùng paymentId; DB vẫn chỉ có 1 Payment |
| Tài chính chưa xác thực | PASS tính trung thực của response: UNKNOWN, outstandingAmount/overdueAmount=null, không giả định nợ bằng 0 |

Nguồn tài chính, trạng thái truy cập và ngữ nghĩa ngày thuê trả `UNKNOWN`. Vì vậy **không kết luận toàn bộ D1 hoàn tất** chỉ từ HTTP 200 của danh sách/chi tiết.

Correlation ID detail Customer: `815e3081-1c04-4225-8071-a069bf7be9eb`.
Correlation ID detail Manager: `80093130-1482-486f-a926-b49b8bef4b53`.

## 4. D2: happy path BLOCKED

| Kiểm tra | Kết quả |
|---|---|
| Customer và Manager liệt kê yêu cầu gia hạn | PASS đọc, HTTP 200, 0 yêu cầu |
| GET renewal-options cho Rental thực tế | BLOCKED, HTTP 409 |
| POST renewal-quote với code gói có thật | BLOCKED, HTTP 409 |
| Tạo yêu cầu, replay request, Manager duyệt/từ chối | NOT RUN / BLOCKED bởi chưa có quote hợp lệ |
| renewal-options không JWT | PASS guard, HTTP 401 |
| Manager gọi renewal-options của Customer | PASS guard, HTTP 403 |
| Manager list renewals với size=0 | PASS guard, HTTP 400 |

Lỗi trực tiếp:

```text
CONFLICT: DEFERRED_SOURCE: Rental date provenance is unknown
```

- Options correlation ID: `f8b980ee-73ba-4e46-a6e0-1ca21d054f89`.
- Quote correlation ID: `2ad24af3-d70e-4918-be75-bc5bb6345ef6`.
- `RentalPeriodResolver.require()` không lấy được nguồn ngày xác thực.
- `ProjectHandoffRentalPeriodAdapter` được đăng ký có điều kiện `storagehub.integration.rental-period.enabled=true`, mặc định không bật khi thiếu property. `run-dev.ps1` và application.properties không thiết lập flag này; phiên chạy hiện tại trả dateSemantics UNKNOWN.
- DB đã lưu audit `CUSTOMER_RECEIPT_CONFIRMED` với `rentalPeriodEvidence.schema=CUSTOMER_RECEIPT_PERIOD_V1`, convention EXCLUSIVE. Không phải chỉ thiếu bản ghi Rental trong DB.
- JWT Manager seed không có `rentals:update`, trong khi D2 decision yêu cầu `MANAGE_RENTALS` tương ứng `rentals:update`. Đây là dependency quyền cần xử lý trước test duyệt; chưa gọi quyết định trên một Renewal thật vì chưa tạo được Renewal.
- Điều kiện cửa sổ gia hạn, policy, tài chính, hold và lifecycle chưa được chứng minh vượt qua: cổng ngày thuê đã chặn trước. Không khẳng định bật flag ngày thuê sẽ giải quyết toàn bộ D2.

Không bật thêm adapter, sửa seed/RBAC, thay ngày thuê hoặc tạo quote/renewal giả trong lượt này.

## 5. Đối chiếu DB thật sau kiểm thử

Truy vấn SELECT join Rental–Reservation–StorageUnit–CheckIn–UnitAssignment xác nhận:

```text
Rental 1031d4d6-1b84-481f-a706-7e76bd368d69: active
Reservation RSV-33608B4F6402: COMPLETED
StorageUnit HCM-Q1-F01-S-002: occupied
CheckIn: completed, rental_id khớp Rental
UnitAssignment: COMPLETED
start_date=2026-10-10, contract_end_date=2027-01-10
monthly_price=5500000.00
```

Số lượng sau đọc lại: Rentals=1, Renewals=0, Payments=1. Dữ liệu fixture được giữ lại để người dùng mở FE xem; không tự xóa hoặc reset DB.

## 6. Kiểm thử FE bổ sung và giới hạn bằng chứng

```powershell
npm run test -- src/services/rentalRenewalApi.test.ts src/views/customer/customerRentalApiIntegration.test.tsx src/views/rental-api/renewalInteractionSafety.test.tsx src/views/rental-api/rentalPeriodPresentation.test.tsx
```

PASS: 4 file, 88 test. Đây là kiểm thử tự động trong repo, không phải bằng chứng E2E trình duyệt với DB thật; không dùng response mock của test để thay thế các lệnh HTTP live ở trên.

- `git diff --check`: PASS; có cảnh báo chuẩn hóa LF/CRLF trên thay đổi đã tồn tại, không có lỗi whitespace.
- Browser E2E Customer/Staff/Manager: BLOCKED bởi không có trình duyệt khả dụng trong công cụ.
- Kiểm tra khác Customer truy cập Rental của người khác: NOT RUN, chưa có tài khoản Customer thứ hai phù hợp trong fixture này.
- Không chạy toàn bộ suite/typecheck/build trong lượt này vì không sửa source.
- Các lỗi ở harness đã sửa cách kiểm tra, không tính là lỗi ứng dụng: gửi enum `ended` không thuộc contract (đổi sang `completed`); tìm q bằng UUID không thuộc trường tìm kiếm; truy vấn nhầm tên cột `unit_code` (đổi sang `code`); hiển thị UUID binary (đổi sang BIN_TO_UUID).
- Kiểm tra listener bằng Get-NetTCPConnection bị sandbox từ chối; readiness đã được xác nhận trực tiếp bằng HTTP thành công ở cả hai cổng.

## 7. Phạm vi thay đổi và bước tiếp theo

Không sửa source FE/BE, shared security, schema hoặc migration; không SQL INSERT/UPDATE/DELETE. BE chạy cấu hình startup hiện hữu của người dùng. Chỉ thêm báo cáo này; mọi thay đổi worktree có sẵn được giữ nguyên, chưa commit/push.

Để hoàn thành happy path D2 cần một lượt riêng xác minh/bật các integration adapter phù hợp, giải quyết nguồn đang UNKNOWN và quyền D2 Manager, rồi chuẩn bị Rental đủ điều kiện cửa sổ gia hạn qua flow hợp lệ. Không thể gọi kết quả hiện tại là E2E D1–D2 đầy đủ.
