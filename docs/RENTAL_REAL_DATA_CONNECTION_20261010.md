# Nối dữ liệu thật cho hồ sơ thuê và quy ước ngày hết hạn

Ngày kiểm tra: 10/10/2026, Asia/Saigon.

## Kết quả và phạm vi

Story: Customer/Manager mở chi tiết hồ sơ → endpoint hồ sơ thuê hiện có → Rental và Reservation trong DB → snapshot giá/giao dịch đã lưu → validator và component FE hiện có.

Đã nối nguồn đọc thật; không xác nhận toàn bộ công nợ hoặc hoàn tất thanh toán/ký khi thiếu nguồn. Không sửa writer đặt chỗ/nhận kho/trả kho, quyền chung, schema hoặc migration trong lượt này. Không commit/push. Giữ các thay đổi worktree có sẵn.

## Dữ liệu trong DB test đã đối chiếu qua API

DB: MySQL `storagehub_local`, container `storagehub-mysql`. BE mới chạy 8081, FE test 8444 trỏ 8081; các phiên đang chiếm 8080/8443 được giữ nguyên. BE mới khởi động thành công, Hibernate `ddl-auto=validate`, Flyway và seed demo tắt trong phiên kiểm tra.

Hồ sơ: `1031d4d6-1b84-481f-a706-7e76bd368d69`.

| Nguồn/ý nghĩa | Giá trị DB và response thật |
|---|---|
| Ngày hết hạn đang lưu, không sửa DB | 10/01/2027 |
| Ngày cuối sử dụng theo quy ước đã được người dùng duyệt | 10/01/2027, INCLUSIVE |
| Mốc kết thúc không bao gồm ngày đó | 11/01/2027 |
| Tiền thuê ban đầu theo thỏa thuận | 16.500.000 đ |
| Tiền đặt chỗ theo thỏa thuận | 6.600.000 đ |
| Cọc bảo đảm theo thỏa thuận, không phải cọc thực nhận | 5.500.000 đ |
| Tiền thuê còn lại sau khoản đặt chỗ theo thỏa thuận | 9.900.000 đ |
| Khoản phải thanh toán khi nhận kho theo thỏa thuận | 15.400.000 đ |
| Tổng nghĩa vụ ban đầu theo thỏa thuận | 22.000.000 đ |
| Giao dịch đã lưu | 6.600.000 đ, PAID, SIMULATED |
| Dư nợ/cọc thực nhận/hạn nghĩa vụ kế tiếp | UNKNOWN, không suy ra từ snapshot hoặc mô phỏng |
| Quyền ra/vào kho | UNKNOWN, không suy ra từ Rental active |

Customer và Manager: GET chi tiết đều 200, cùng `bookingEvidence` và ngày INCLUSIVE. GET ledger Customer 200, completeness UNKNOWN. GET policy gia hạn của BO 404 NOT_FOUND: chưa công bố, người dùng sẽ nhập trên BO; không tự tạo giá trị.

Số bản ghi trước/sau kiểm tra nguồn kinh doanh giữ nguyên: Rental 1, Payment 1, snapshot 1; ledger account 0, outbox 0. Ngày Rental giữ nguyên. Flyway vẫn ở `2026101001`, success=1. Đăng nhập kiểm tra có tạo session/login history thông thường; không có POST nghiệp vụ gia hạn/thanh toán/ký.

## Contract bổ sung, endpoint giữ nguyên

- `GET /api/customer/rental-records/{id}`
- `GET /api/manager/rentals/{id}`

Thêm `bookingEvidence` nullable/optional. Không thay financialSummary/access hay phương thức/path/request.

`bookingEvidence`: rentalId, reservationId, currency=VND, agreedAmounts nullable, payments (tối đa 20), paymentsTruncated.

agreedAmounts: netRentalAmount, reservationDepositAmount, securityDepositAmount, remainingRentalAmount, dueAtCheckIn, totalInitialObligation. Kiểm tra không âm và các tổng khớp nhau. Đây là snapshot ban đầu, không phải số dư hiện tại hoặc xác nhận đã nhận tiền.

payment: id dùng làm React key, purpose/status dịch sang tiếng Việt, amount, processedAt nullable, verification SIMULATED hoặc UNVERIFIED. Không trả gatewayIntentId/idempotencyKey/failure details. PAID không tự trở thành VERIFIED_BANK. Trường bị thiếu hoặc null vẫn tương thích server cũ, không tạo dữ liệu thay thế.

Manager cần VIEW_RENTALS, READ scope đúng cơ sở và VIEW_PAYMENTS để nhận trường mới. Nếu không có VIEW_PAYMENTS, trường này null, không mở rộng quyền. Customer chỉ đọc hồ sơ của mình. FE kiểm tra binding Rental/Reservation, currency, tổng tiền, enum, bản ghi trùng và giới hạn lịch sử; lỗi nguồn không dùng fallback demo.

## Quy ước ngày, hồ sơ cũ và mới

Theo phê duyệt người dùng, nguồn đọc D1-D4 áp dụng dùng hết ngày hết hạn cho cả hồ sơ cũ và mới khi quan hệ bàn giao/audit đủ xác minh. Không backfill date hoặc sửa audit lịch sử. Hồ sơ thiếu/không khớp quan hệ vẫn UNKNOWN, không biến dữ liệu hỏng thành xác thực.

Flag mới `storagehub.integration.rental-period.inclusive-end` mặc định false, chỉ có tác dụng khi adapter rental-period được bật. `run-rental-support-dev.ps1` bật hai flag này cho local test. Runner `run-dev.ps1` gốc và cấu hình shared không bị sửa.

Legacy receipt chưa có versioned metadata có thể dùng quy ước hiện tại nếu audit đúng khách/cơ sở/Rental, bàn giao completed và ngày Rental khớp Reservation. Evidence reference nêu quy ước hiện tại, không giả lập chứng cứ lịch sử. Proof sai/ambiguous, renewal completed thiếu evidence vẫn bị chặn.

D1 dùng cùng source; D2 tạo kỳ mới từ ngày kế tiếp ngày hết hạn; D3 kiểm tra accepted terms khớp kỳ chuẩn hóa, báo giá EXCLUSIVE cũ phải requote thay vì tự đổi ngày/tiền; D4 tính quá hạn từ ngày kế tiếp và yêu cầu policy cùng lastPermittedDate.

## File thuộc thay đổi lượt này

BE:

- `api/rental/RentalBookingEvidence.java`, `RentalDetailResponse.java`: DTO đọc bổ sung.
- `service/rental/RentalBookingEvidenceReader.java`: query snapshot/payments có quyền và binding, read-only.
- `service/RentalQueryService.java`: nối reader vào chi tiết đã scope.
- `service/rental/period/ProjectHandoffRentalPeriodAdapter.java`: quy ước hiện tại opt-in, giữ kiểm tra proof.
- `run-rental-support-dev.ps1`: bật inclusive-end cho local test, không thay runner chung.
- Tests RentalBookingEvidenceJpaTests, RentalQueryServiceTests, ProjectHandoffRentalPeriodAdapterTests, OverdueServicePaginationTests, InclusiveRenewalCompatibilityTests.

FE:

- `src/types/rentalApi.ts`, `src/services/rentalBookingEvidence.ts`, `src/services/rentalApi.ts`: type/validation nguồn đọc thật.
- `src/views/rental-api/RentalDetail.tsx`: hiển thị thỏa thuận và giao dịch ngay trong chi tiết Customer/Manager, giữ công nợ/access UNKNOWN.
- `src/views/rental-api/rentalBookingEvidence.test.tsx`, `tests/rentalLiveDataRead.test.tsx`: regression và real API read/render.
- Báo cáo này.

Rà React: một component production được sửa, không thêm fetch trong render hoặc hook có điều kiện; danh sách dùng payment.id; nhãn số tiền in đậm; disclosure simulation và unknown giữ rõ; không thêm route/global CSS/shared shell.

## Kiểm thử và bằng chứng

| Kiểm tra | Kết quả |
|---|---|
| BE đọc snapshot/payments bằng SQL trên H2 rollback | PASS, 7 tests |
| D1 RentalQueryService | PASS, 12 tests |
| Date adapter + RentalPeriod + shared receipt compatibility | PASS, 18 + 5 + 5 tests |
| D2 RenewalWorkflow integration | PASS, 15 tests |
| D3 RenewalOperation integration | PASS, 25 tests |
| D4 Overdue pagination/ngày cuối | PASS, 9 tests |
| Gia hạn INCLUSIVE và requote báo giá EXCLUSIVE cũ | PASS, 2 tests; tổng BE 98 tests không trùng |
| FE validator/copy/no fallback/date/renewal safety | PASS, 177 tests trong 5 files |
| API thật → DB thật → FE getRental validator → static render | PASS, 2 tests, Customer/Manager, không mock response |
| Build FE | PASS, 747 modules, còn cảnh báo bundle lớn |
| Typecheck FE | FAIL baseline: 8 lỗi ngoài lượt sửa ở AdminPortalLogin/HomePage/ManagerApiStaffTasksPanel/ProfileView; không có lỗi trong file mới |
| Git diff --check | PASS |
| Browser E2E/screenshot | BLOCKED: browser inventory rỗng; createBrowserTab báo Browser is not available: iab. Không có screenshot hoặc xác nhận thao tác browser |

Lần chạy Maven đầu có lỗi kiểu permission trong test mới; đã sửa dùng `.code()` và chạy lại PASS. Lần typecheck đầu có Object.hasOwn không phù hợp target; đã sửa ở helper cục bộ, không đổi tsconfig chung.

Lệnh BE dùng `mvnw.cmd -Dtest=<các class trên> test` với H2 in-memory, profile test, Flyway=false; không dùng create/update trên DB local. Surefire XML lưu ở BE `target/surefire-reports/`.

Lệnh FE: `npm.cmd run test -- src/views/rental-api/rentalBookingEvidence.test.tsx src/views/rental-api/rentalPeriodPresentation.test.tsx src/services/rentalRenewalApi.test.ts src/services/rentalOperationsOverdueApi.test.ts src/views/rental-api/renewalInteractionSafety.test.tsx`.

Test live cần opt-in `STORAGEHUB_TEST_LIVE_READ=1`, VITE_API_BASE_URL=http://localhost:8081 và bốn biến credential Customer/Manager do môi trường test cung cấp; chạy `npm.cmd run test -- tests/rentalLiveDataRead.test.tsx`. Không lưu token/password trong file hoặc báo cáo. Mặc định 2 test live SKIP, không phải PASS giả.

## Còn thiếu, không đánh dấu hoàn tất toàn bộ flow

| Dependency | Trạng thái / người phụ trách cần phối hợp |
|---|---|
| Bao phủ nghĩa vụ tài chính, khoản thu thực, phân bổ, hoàn tiền/tranh chấp | BLOCKED_SOURCE: nguồn Payment hiện có mô phỏng, ledger chưa có coverage; owner Payment/Finance/Return + consumer rental ledger |
| Quyền truy cập kho | BLOCKED_SOURCE: chưa có authoritative AccessSource; owner Access/Inventory, không suy từ active |
| Policy BO | BLOCKED_DATA: chưa công bố; người dùng nhập trên BO như đã thống nhất |
| Lịch ký/giờ làm việc/thời lượng lịch hẹn | BLOCKED_SOURCE: giữ chặn, không tạo lịch hoặc ký giả |
| Lịch đặt chỗ/giữ chỗ liên writer | NEEDS_CROSS_FLOW_VERIFICATION: shared ReservationRepository dùng start < end và end > start (exclusive). Không đổi writer/shared overlap trong lượt này; owner Booking/Inventory cần thống nhất boundary/hold trước khi bật toàn team |

Không tuyên bố đã kiểm thử browser E2E từ đặt chỗ → thanh toán thật/ký → gia hạn hoàn tất. Không mở khóa hành động thiếu nguồn và không giả cọc đã thu/dư nợ 0/quyền truy cập active.
