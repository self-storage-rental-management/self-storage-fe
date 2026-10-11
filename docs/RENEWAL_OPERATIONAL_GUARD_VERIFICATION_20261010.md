# Gia hạn: kiểm chứng xung đột vận hành và phạm vi quyền - 10/10/2026

## Kết luận

Đã bổ sung helper chỉ đọc `RenewalOperationalGuard` cùng 21 test mới PASS. **Chưa nối helper vào consumer, chưa tạo EligibilitySource/ExtensionHoldSource/ApprovalLifecycleSource, chưa cấp grant hoặc bật scheduler.** Không đánh dấu các port này IMPLEMENTED/READY. Người dùng chọn giữ chặn khi thiếu nguồn tài chính/lịch ký.

Patch ban đầu có consumer wiring, scheduler expiry và grant Manager opt-in đã bị cơ chế auto-review từ chối **trước khi áp dụng** vì mutation theo lịch và grant `rentals:update` dùng chung có thể ảnh hưởng flow Return. Không tách patch để thực hiện lại các hành động bị chặn. Phương án thay thế đã được chấp nhận chỉ thêm helper chỉ đọc và test cô lập; mọi thay đổi nghiệp vụ/security trong patch bị từ chối đều chưa được ghi vào worktree.

## File mới và hành vi

| File BE | Nội dung |
|---|---|
| src/main/java/com/storagehub/service/renewal/integration/RenewalOperationalGuard.java | Đọc JPA: rental active/chưa trả, unit đúng facility và occupied, ReturnCase, MaintenanceTask, Rental/Reservation khác trên unit, RECOVERY_HANDOFF đã lưu |
| src/test/java/com/storagehub/service/renewal/integration/RenewalOperationalGuardJpaTests.java | 15 ca với dữ liệu H2 rollback, không seed DB local |
| src/test/java/com/storagehub/service/renewal/integration/RenewalGuardActivationAndScopeTests.java | 6 ca activation mặc định tắt và permission/scope hiện hữu |

Helper có property `storagehub.integration.renewal-operational-checks.enabled`, mặc định tắt. Runner local không bật property; không consumer nào gọi helper hiện tại. Helper chỉ SELECT; không writer, lịch chạy, API hoặc schema mới.

Nguyên tắc:

- Đi qua các kiểm tra chỉ có nghĩa **không tìm thấy xung đột đã biết**, không phải đủ điều kiện gia hạn.
- Bất kỳ ReturnCase nào trên rental hiện tại đều chặn để cần reconciliation; không tự hủy hồ sơ trả kho, kể cả dữ liệu rental/return có mâu thuẫn.
- Bảo trì open/in_progress chặn; completed/cancelled không bị coi là bảo trì đang mở.
- Booking khác đã gán cùng gian kho chặn; booking gốc và booking terminal không bị coi là cam kết mới.
- Handoff recovery đã lưu chặn; không có handoff không chứng minh recovery bên ngoài chưa bắt đầu.
- READ_COMMITTED/composite SELECT không tạo coherent snapshot đến commit, không thay protocol shared writer hoặc durable hold. Không dùng helper này như SafetySource atomic=true.
- Không đổi occupied thành available vì contract hết hạn; không suy ra khoản phải thanh toán/cọc/thu tiền từ trạng thái vận hành.

## Test và bằng chứng hiện tại

| Nhóm | Kết quả |
|---|---|
| RenewalOperationalGuardJpaTests | PASS 15/15 |
| RenewalGuardActivationAndScopeTests | PASS 6/6 |
| RenewalWorkflowIntegrationTests | PASS 15/15: cancellation, replay, changed terms, finance/lifecycle guard, rollback |
| RenewalOperationIntegrationTests | PASS 25/25: payment/signing expiry, guarded completion và retry; provider là fixture test-only, không phải runtime sources |
| ReservationCapacityServiceTests | PASS 5/5 |
| UnitAssignmentServiceTests | PASS 4/4 |
| ReturnSettlementServiceTests | PASS 7/7 |
| RolePolicyOwnershipTests | PASS 2/2 |
| MaintenanceServiceTests | FAIL: 3 ERROR/9 test, 6 PASS; lỗi Assigned user must be an active Staff with OPERATE scope at this facility |
| FE tương ứng | PASS 122/122, 4 file: renewalInteractionSafety, rentalPeriodPresentation, integrationPresentation, duongIntegrationApi |
| git diff --check, FE và BE | PASS cho tracked diff; cảnh báo chuyển LF/CRLF, không whitespace error |

Tổng test BE duy nhất: 88, gồm 85 PASS và 3 ERROR; không cộng lần chạy Maintenance lặp. Các lỗi Maintenance tái hiện ở hai lần chạy; source MaintenanceService.java và MaintenanceServiceTests.java không có diff so với HEAD, không phụ thuộc helper mới. Không sửa fixture hoặc quyền của teammate để làm xanh test. Đây là bằng chứng lỗi ngoài phần bổ sung hiện tại, không khẳng định mọi lỗi của toàn repo đều đã audit.

Lệnh BE đã chạy trên H2 in-memory, không datasource MySQL local:

```powershell
.\mvnw.cmd '-Dtest=RenewalOperationalGuardJpaTests,RenewalWorkflowIntegrationTests,RenewalOperationIntegrationTests,RolePolicyOwnershipTests,ReservationCapacityServiceTests,UnitAssignmentServiceTests,MaintenanceServiceTests,ReturnSettlementServiceTests' test '-Dspring.datasource.url=jdbc:h2:mem:storagehub;MODE=MySQL;DB_CLOSE_DELAY=-1' '-Dspring.datasource.driver-class-name=org.h2.Driver' '-Dspring.datasource.username=sa' '-Dspring.datasource.password=' '-Dspring.flyway.enabled=false'
.\mvnw.cmd '-Dtest=RenewalGuardActivationAndScopeTests,MaintenanceServiceTests' test '-Dlogging.level.root=WARN'
```

H2 test profile sử dụng create-drop cho DB in-memory cô lập; **không đổi ddl-auto của storagehub_local**. Không reset/xóa/sửa schema hoặc policy DB test đang dùng.

Lệnh FE thực tế dùng `npm.cmd` vì PowerShell chặn shim npm.ps1. Filter ban đầu chứa thêm `src/services/renewalApi.test.ts`, file này không tồn tại và không được tính là test đã chạy. Bốn file tồn tại nêu trên đã chạy, exit 0.

## Đối chiếu FE - BE theo skill verification

Story: Customer yêu cầu/báo giá gia hạn → Manager duyệt trong facility MANAGE → Customer thanh toán và lịch ký → Staff xác minh/chốt → API đọc lại dữ liệu DB. Phải giữ retry cùng payload/key và không coi simulation là tiền thật.

| Boundary | Trạng thái | Bằng chứng |
|---|---|---|
| UI renders/browser | BLOCKED_NOT_RUN | Không có browser evidence/screenshot mới |
| FE HTTP localhost:8443 | BLOCKED_CONNECTION | Invoke-WebRequest: Unable to connect to the remote server |
| BE HTTP localhost:8080/v3/api-docs | BLOCKED_CONNECTION | Invoke-WebRequest: Unable to connect to the remote server; không có listener 8080/8443 khi kiểm tra |
| Client → controller | PASS_STATIC | renewalApi.ts gọi renewal-options, renewal-quote, renewal-requests và manager decision; không đổi path/method/DTO |
| Response → UI/retry | PASS_TEST_ONLY | 122 test FE; không suy ra browser E2E hoặc API mutation thật |
| API → DB thật trong lượt này | NOT_RUN | Service không chạy; không gửi mutation/live read mới |

Skill verification yêu cầu dừng ở boundary lỗi; dừng E2E live tại kết nối local, không đi tiếp để tạo policy/tiền/approval giả. Các HTTP 200 và Flyway PASS trong `RENTAL_LEDGER_LOCAL_ROLLOUT_20261010.md` là bằng chứng phiên trước, không chứng minh service hiện vẫn đang chạy.

## Việc còn lại và rủi ro cần duyệt riêng

1. **Consumer wiring:** helper chỉ đọc có thể thêm kiểm tra âm ở gate/completion; cần test tích hợp flow và reload snapshot đúng transaction, không coi nó là guarantee chống race.
2. **P05 eligibility:** cần recovery/current lifecycle có thẩm quyền, cutoff BO và khả năng hoàn tất lịch ký. Không có dữ liệu thì UNKNOWN/deferred.
3. **P07/P10 hold/safety:** cần durable interval/ref/TTL/revision binding và protocol chung Booking/Assignment/Return/Maintenance. Một khóa trong flow gia hạn không đủ nếu writer khác không tham gia. Cần đánh giá additive writer hooks và schema nếu phải lưu hold mới; không dùng Reservation giả hoặc in-memory hold.
4. **Expiry:** scheduler phải gọi command expire hiện có theo từng transaction, recheck payment in-flight và matching hold; thiếu accounting/safety thì không expire hay release unit. Chưa triển khai/bật scheduler trong lượt này.
5. **Manager grant:** MANAGE_RENTALS = rentals:update còn được ReturnSettlementService.reviewDispute dùng chung. Cấp grant sẽ mở quyền review tranh chấp Return trong phạm vi hiện hữu, không chỉ nút duyệt D2. Cần duyệt rõ tác động này trước persistent grant; không sửa shared checks hoặc cấp quyền rộng toàn cơ sở.
6. **Nguồn thật:** policy do người dùng nhập BO; financial coverage/calendar chưa đủ vẫn chặn. Không mock/hardcode response ở chế độ xác thực thật. Fixtures chỉ nằm trong test cô lập.
7. **E2E:** sau khi server chạy và các source thật đủ, kiểm thử qua FE happy-path + hủy/hết hạn/uncertain retry/race. Hiện chưa chứng nhận full luồng.

Không commit/push. Không sửa thêm FE UI, shared source/security, migration hay run scripts trong lượt này. Giữ nguyên toàn bộ thay đổi có trước của người dùng.
