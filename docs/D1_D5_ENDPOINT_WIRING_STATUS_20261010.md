# Endpoint D1-D5: wiring FE và trạng thái BE local

> Trạng thái mới lúc 22:50: ledger/communication đã bật trên storagehub_local; ba role đọc ledger HTTP 200, financialSummary vẫn UNKNOWN và policy BO chưa công bố. Xem [báo cáo rollout](RENTAL_LEDGER_LOCAL_ROLLOUT_20261010.md). Các mục tắt module/thiếu schema bên dưới là audit lịch sử trước rollout, không còn là trạng thái phiên hiện tại.

> Cập nhật sau audit: xem `D1_D5_ORDERED_REMEDIATION_20261010.md`. Đã sửa thông báo lỗi đọc ledger và bật riêng adapter ngày thuê trong phiên BE chạy với `ddl-auto=validate`. D1 Customer/Manager trả dateSemantics COMPLETE; D2 hiện bị chặn bởi policy BO thay vì provenance ngày thuê. Ledger/communication vẫn tắt vì thiếu schema. Các kết quả UNKNOWN ngày thuê và copy lỗi GET bên dưới là bằng chứng lịch sử trước lượt sửa, không phải trạng thái phiên BE mới.

Ngày kiểm tra: 10/10/2026, Asia/Ho_Chi_Minh.

Phạm vi: Rental D1, Renewal D2/D3, Overdue D4, Support D5 và các endpoint bổ sung ledger/policy/notification của Dương. Không đồng nhất audit này với toàn bộ API của các thành viên khác.

## Kết luận

- Đã in đậm 12 nhãn `<dt>` của chi tiết hồ sơ thuê; không đổi giá trị hoặc logic hiển thị.
- Không tìm thấy endpoint nghiệp vụ chính của D1-D5 hoàn toàn thiếu lời gọi FE trong các controller/client đã đối chiếu. Đây là kiểm chứng wiring tĩnh, không phải chứng nhận mọi flow chạy thành công.
- Có **1 endpoint đọc chưa có caller riêng**, nhưng nó là alias của endpoint đã dùng.
- Có **2 endpoint GET có client nhưng không được UI gọi**, vì UI dùng bản `/stored` để đọc/đối chiếu chính sách.
- Ledger, notification acknowledgement và communication policy đã có wiring FE, nhưng BE local chưa bật module tương ứng. Không phân loại chúng là “chưa nối FE”.
- D1 detail đã chứa trường tài chính/truy cập/ngày thuê; giá trị UNKNOWN không chứng minh FE thiếu API riêng cho từng nhãn.

## 1. Endpoint chưa được UI gọi trực tiếp

| Method / endpoint | FE hiện tại | Đánh giá |
|---|---|---|
| GET `/api/customer/renewals/{id}/appointment` | Không có caller riêng. RenewalOperationsPanel gọi GET `/api/customer/renewals/{id}/operations` và hiển thị appointmentStart/appointmentEnd/appointmentRef | ALIAS_NOT_CALLED, không phải thiếu toàn bộ chức năng lịch hẹn. BE appointmentDetail gọi chính detail(id,query), cùng response/guard |
| GET `/api/business/facilities/{facilityId}/renewal-policy` | Có `getIntegrationPolicy`, không có caller production ngoài định nghĩa; BO gọi `getStoredIntegrationPolicy` với `/renewal-policy/stored` | SERVICE_ONLY / READBACK_REPLACEMENT. Không nên tự đổi lại GET hiệu lực vì policy future/expired cần được đối chiếu |
| GET `/api/business/facilities/{facilityId}/communication-policy` | Cùng client `getIntegrationPolicy`; BO dùng `/communication-policy/stored` | SERVICE_ONLY / READBACK_REPLACEMENT; module communication hiện còn tắt |

Bằng chứng source:

- BE CustomerRenewalOperationController.java:32-33: appointmentDetail gọi detail.
- FE renewalOperationsApi.ts: `getRenewalOperations`.
- FE RenewalOperationsPanel.tsx: hiển thị lịch từ operation state, gọi getRenewalOperations.
- FE duongIntegrationApi.ts: `getIntegrationPolicy`, `getStoredIntegrationPolicy`.
- FE rental-support-integration/DuongPolicyWorkspace.tsx: đọc và readback bằng getStoredIntegrationPolicy; công bố bằng publishIntegrationPolicy.

Không tự nối thêm request trùng lặp, thay đổi endpoint đang dùng hoặc chuyển logic chính sách trong lượt này.

## 2. Đã nối FE nhưng chưa hoạt động trong BE local

| Method / endpoint | Điểm nối FE | Bằng chứng hiện tại |
|---|---|---|
| GET `/api/customer/rentals/{id}/ledger` | getRentalLedger → LedgerPanel → RentalDetail Customer | Live HTTP 500; không có route trong Swagger runtime |
| GET `/api/manager/rentals/{id}/ledger` | getRentalLedger → LedgerPanel → RentalDetail Manager | Live HTTP 500; không có route trong Swagger runtime |
| GET `/api/business/rentals/{id}/ledger` | LedgerPanel trong BO policy workspace | Live HTTP 500; không có route trong Swagger runtime |
| GET `/api/business/facilities/{id}/communication-policy` | Client có sẵn, UI dùng stored thay thế | Live HTTP 500; route hiệu lực không có trong Swagger runtime |
| PUT `/api/business/facilities/{id}/communication-policy` | publishIntegrationPolicy trong BO | Không có route trong Swagger runtime; không gửi mutation trong audit |
| GET `/api/customer/notifications/{id}/acknowledgement` | getNotificationAcknowledgement → SupportNotificationReceipts | Không có route trong Swagger runtime; không probe bằng ID notification giả |
| POST `/api/customer/notifications/{id}/acknowledgement` | acknowledgeNotification → nút xác nhận Support | Không có route trong Swagger runtime; không gửi mutation trong audit |
| GET `/api/business/facilities/{id}/communication-policy/stored` | BO đọc/readback | Live HTTP 404: `Communication integration is disabled` |

RentalLedgerController được đăng ký khi `storagehub.integration.ledger.enabled=true`. CommunicationIntegrationController được đăng ký khi `storagehub.integration.communication.enabled=true`. Hai nhóm route không có trong Swagger của phiên BE chạy theo run-dev.ps1 hiện tại.

HTTP 500 là kết quả thật đã quan sát, không thay thành 404 trong báo cáo. GlobalExceptionHandler có nhánh catch-all trả INTERNAL_ERROR; chưa chẩn đoán stack trace của từng request nên không khẳng định mọi 500 chỉ do cùng một exception. Nguồn module tắt và route runtime không đăng ký đã được đối chiếu riêng.

Không bật flag hoặc sửa schema/security để che lỗi. Cần kiểm tra điều kiện rollout/schema/source của module trước một lượt bật và test riêng.

## 3. Đã nối nhưng bị chặn vì nguồn hoặc dữ liệu

| Endpoint / trường | Kết quả | Ý nghĩa |
|---|---|---|
| GET `/api/customer/rentals/{id}/renewal-options` | Live HTTP 409: `DEFERRED_SOURCE: Rental date provenance is unknown` | FE đã gọi; BE chưa lấy được bằng chứng ngày thuê qua adapter runtime |
| POST `/api/customer/rentals/{id}/renewal-quote` | Có client/UI; lượt test flow trước đã trả cùng 409 | Không thử tạo quote lại trong lượt audit đọc này |
| GET `/api/business/facilities/{id}/renewal-policy/stored` | Live HTTP 404: `Policy has not been published` | Route đã hoạt động, chưa có policy được công bố cho cơ sở kiểm tra |
| GET `/api/customer/rental-records/{id}`, GET `/api/manager/rentals/{id}` | Lượt flow trước HTTP 200; financialSummary, access và dateSemantics UNKNOWN | Cọc/dư nợ/hạn thanh toán/truy cập không phải những endpoint FE riêng chưa nối. Chúng là phần projection của Rental detail, phụ thuộc nguồn BE |

Chưa có đủ bằng chứng xác nhận tạo yêu cầu, duyệt gia hạn, hold, ký và hoàn tất thành công trên môi trường này. Không suy rằng chỉ bật flag ngày thuê sẽ giải quyết toàn bộ dependency.

## 4. Bằng chứng HTTP chỉ đọc trong lượt này

BE `http://localhost:8080`, DB theo môi trường run-dev.ps1 đã chạy. Customer, Manager và Business seed đăng nhập HTTP 200. Không đưa token/mật khẩu vào báo cáo.

Rental kiểm tra: `1031d4d6-1b84-481f-a706-7e76bd368d69`.
Cơ sở: `89fe8d93-65be-4612-91c8-a3e805e56937`.

| Request | HTTP | Correlation ID |
|---|---|---|
| Customer ledger | 500 | f7cad9fa-b92a-4e33-a755-ee3e0fd3e25e |
| Manager ledger | 500 | 95e07351-305f-45cb-9d10-68fcfa78b1d5 |
| Business ledger | 500 | 6131c977-934a-4c11-87ea-28414fc7c7b3 |
| Customer renewal-options | 409 | bafb645c-dbc0-44e7-8fa5-8e805a8c429d |
| Business communication-policy | 500 | 1e96bae1-9d0a-4cf4-a25b-2dea03539759 |
| Business communication-policy/stored | 404 | 1bda36b2-25c9-4dc9-855c-582b6643e5c0 |
| Business renewal-policy/stored | 404 | 4d3ef9ea-3228-4eae-aa3a-0a4faa7e432b |

Swagger/runtime chỉ được đọc. Không gửi PUT policy, POST payment, acknowledgement hoặc tạo dữ liệu nghiệp vụ trong lượt này. Login có thể ghi session/login history theo flow Auth hiện hữu.

Thông báo trong ảnh “Chưa xác định được kết quả... thử lại cùng nội dung...” khớp nhánh integrationError cho HTTP >=500/network. Ledger ở đây là GET; dùng cùng copy retry của mutation có thể gây hiểu nhầm. Chỉ ghi nhận, chưa thay copy hoặc error handling ngoài yêu cầu in đậm nhãn.

## 5. Phương pháp và giới hạn audit

Chạy logic của connectivity-inventory.cjs trong bộ nhớ, đọc source FE/BE; các ghi artifact của script được thu vào bộ nhớ, không sửa script, BE hoặc sinh inventory toàn repo vào worktree.

Parser ban đầu chưa mở rộng role/kind/suffix trong duongIntegrationApi.ts, nên báo sai các ledger, stored policy và coordination là thiếu caller. Đã đối chiếu thủ công template, role allowlist, kind allowlist, method và nơi import/render trước kết luận.

GET `/api/customer/rentals/{id}` của CustomerRentalController legacy không có client detail riêng trong source hiện tại. Đây là endpoint shared của flow Customer gốc, không tự tính thành gap D1-D5 hoặc sửa controller/client teammate. D1 detail dùng `/api/customer/rental-records/{id}`.

## 6. Sửa giao diện và kiểm thử

- RentalDetail.tsx: thêm `font-bold` cho 12 nhãn `<dt>`, không sửa `<dd>`, dữ liệu, handler hoặc API.
- rentalPeriodPresentation.test.tsx: test đủ 12 nhãn, giữ nguyên id/tên khách, nhánh ngày UNKNOWN vẫn có nhãn in đậm.
- PASS: 3 file, 50 test (rentalPeriodPresentation, presentation, emptyDataPresentation).
- PASS: npm run build, chỉ cảnh báo bundle lớn.
- Chưa chạy lại full suite/typecheck hoặc browser screenshot trong lượt này. Typecheck ở lượt đổi tên trước có 8 lỗi baseline không thuộc chỉnh style này.
- Giữ các thay đổi local trước đó, không sửa BE/DB/security/migration, chưa commit/push.
