# Các thay đổi cần thực hiện: thông tin kho, giá và bộ giảm giá

Ngày lập: 2026-10-13  
Tài liệu hiện trạng liên quan: `FACILITY_PRICING_CURRENT_FLOW_20261013.md`.

## Trạng thái triển khai ngày 13/10/2026

- Đã đổi tạo cơ sở sang trạng thái `setup`; không còn tự sinh loại kho, gian kho và gói thuê từ màn BO.
- Đã bổ sung API Manager tạo/cập nhật loại kho kỹ thuật và số gian kho vật lý; loại kho mới ở trạng thái `awaiting_pricing`.
- Đã bổ sung API và giao diện BO đọc đúng danh sách loại kho Manager đã tạo, cấu hình giá tháng và tiền đảm bảo theo từng loại.
- Đã bổ sung bước BO công bố; backend chặn công bố nếu thiếu loại kho, giá hợp lệ, tồn kho vật lý hoặc gói thuê đang hiệu lực.
- Customer chỉ truy vấn cơ sở `active` và loại kho `active`; màn chi tiết API không còn chèn bộ giảm giá, sức chứa mẫu hoặc tiện ích hard-code.
- Báo giá lưu snapshot giá tháng, chiết khấu, mã/version gói; gia hạn đọc bảng giá đang hiệu lực để tạo kỳ mới độc lập.
- Danh mục hàng hóa dùng danh sách chung của form Customer; nhóm `OTHER` tiếp tục đi qua trạng thái cần Staff duyệt.

## 1. Quyết định nghiệp vụ đã thống nhất

### 1.1 Phân quyền

- BO tạo/quản lý Facility và các chính sách thương mại: giá, cọc, phí, package, discount và thời gian hiệu lực.
- Manager tạo/quản lý UnitType và StorageUnit trong facility được phân quyền.
- Staff chỉ thực hiện vận hành và duyệt hàng hóa `OTHER`.
- Customer chỉ đọc dữ liệu đã công bố từ backend.

### 1.2 Loại khỏi phạm vi

Loại bỏ hoàn toàn khỏi mô hình mục tiêu, form, validation và Customer detail:

- `doorWidthM`;
- `doorHeightM`;
- `allowedGoods` theo kho;
- `prohibitedGoods` theo kho.

Danh mục hàng hóa là danh mục chung của form Customer. `OTHER` bắt buộc Staff duyệt.

### 1.3 Giá và package

- Manager phải tạo UnitType trước để có `unitTypeId`.
- BO đặt giá tháng và tiền cọc cho UnitType đã tồn tại.
- Package theo phần trăm có thể áp dụng toàn facility mà không phụ thuộc kích cỡ.
- Package có phạm vi chọn UnitType chỉ cấu hình sau khi Manager tạo UnitType.
- Không lưu một `packagePrice` cố định dùng chung cho nhiều kích cỡ; backend tính từ monthlyPrice và discountRate.

## 2. Luồng mục tiêu

Đây là **luồng bắt buộc** của chức năng. Việc triển khai FE, BE, database và phân quyền phải bảo đảm đúng thứ tự này:

```text
BO tạo cơ sở
        ↓
Manager khai báo các loại kho thực tế
        ↓
BO nhận danh sách loại kho đã tồn tại
        ↓
BO cấu hình giá và gói thuê
        ↓
BO công bố
        ↓
Customer nhìn thấy loại kho có giá đang hiệu lực
```

Không được thay đổi thứ tự trách nhiệm bằng cách để BO tự tạo sẵn UnitType kỹ thuật, tự sinh gian kho thay Manager hoặc để Customer nhìn thấy UnitType trước khi BO công bố giá.

### 2.1 Bước 1 - BO tạo cơ sở

- BO chỉ tạo thông tin cấp Facility.
- Facility ở trạng thái `SETUP`, chưa xuất hiện với Customer.
- Không tự sinh S/M/L/XL, UnitType, StorageUnit, giá hoặc package mặc định.
- Sau khi tạo, BO/Admin gán Manager hoặc facility scope phù hợp.

### 2.2 Bước 2 - Manager khai báo loại kho thực tế

- Manager chỉ thao tác trong Facility có scope `MANAGE`.
- Manager tạo UnitType và thông số kỹ thuật thực tế.
- Manager tạo số lượng StorageUnit vật lý, tầng và khu vực.
- UnitType sau khi hoàn tất kỹ thuật chuyển sang `AWAITING_PRICING`.
- Manager không nhập giá, tiền cọc, package hoặc discount.

### 2.3 Bước 3 - BO nhận danh sách loại kho đã tồn tại

- Màn hình pricing của BO phải tải UnitType từ backend theo `facilityId`.
- BO chỉ được cấu hình giá cho `unitTypeId` có thật và thuộc đúng Facility.
- Nếu Manager chưa tạo UnitType, BO thấy trạng thái “Chờ Manager khai báo loại kho”; không dùng dữ liệu S/M/L/XL hard-code.
- Khi Manager thêm hoặc sửa UnitType, danh sách của BO phải được refresh/invalidate.

### 2.4 Bước 4 - BO cấu hình giá và gói thuê

- BO cấu hình `monthlyPrice` và `securityDepositAmount` theo UnitType.
- BO tạo/gán bộ giảm giá theo Facility.
- Bộ có `unitTypeScope=ALL` không cần biết trước số kích cỡ và áp dụng cho mọi UnitType đủ điều kiện.
- Bộ có `unitTypeScope=SELECTED` chỉ chọn các `unitTypeId` đã tồn tại.
- Giá, package và assignment đều phải có version và khoảng hiệu lực.

### 2.5 Bước 5 - BO công bố

Backend chỉ cho công bố khi:

- Facility có thông tin bắt buộc;
- có ít nhất một UnitType ở `AWAITING_PRICING` hoặc trạng thái sẵn sàng tương đương;
- mỗi UnitType được công bố có giá tháng và tiền cọc hợp lệ;
- có package 1 tháng hoặc package mặc định hợp lệ;
- bộ giảm giá/assignment không xung đột thời gian;
- inventory có ít nhất một StorageUnit khả dụng nếu nghiệp vụ yêu cầu mở bán ngay.

Thao tác công bố phải thực hiện trong transaction. Nếu một điều kiện thất bại, không được công bố một phần.

### 2.6 Bước 6 - Customer nhìn thấy dữ liệu đã công bố

- Customer chỉ nhận Facility `ACTIVE/PUBLISHED`.
- Customer chỉ nhận UnitType `ACTIVE/PUBLISHED` có pricing đang hiệu lực.
- Package trả về phải được resolve theo Facility, UnitType, ngày bắt đầu và applicationType.
- Customer không được thấy UnitType `DRAFT`, `AWAITING_PRICING`, thiếu giá hoặc package chưa hiệu lực.
- Customer không dùng localStorage hoặc fallback hard-code để biến dữ liệu chưa công bố thành dữ liệu có thể đặt thuê.

### 2.7 Trạng thái và cổng chuyển tiếp

Facility nên có trạng thái nghiệp vụ:

```text
SETUP → READY_TO_PUBLISH → ACTIVE/PUBLISHED → INACTIVE
```

UnitType nên có trạng thái:

```text
DRAFT → AWAITING_PRICING → ACTIVE → INACTIVE
```

Chỉ BO có quyền chuyển Facility sang `ACTIVE/PUBLISHED` và đưa UnitType đủ điều kiện từ `AWAITING_PRICING` sang `ACTIVE`. Manager hoàn thiện cấu hình kỹ thuật nhưng không tự công bố giá ra Customer.

### 2.8 Tiêu chí kiểm thử đầu-cuối bắt buộc

1. BO tạo Facility → Customer chưa thấy.
2. Manager chưa khai báo UnitType → BO không thể đặt giá cho ID giả.
3. Manager tạo UnitType → BO nhìn thấy đúng ID và thông số kỹ thuật.
4. UnitType chưa có giá → Customer chưa thấy.
5. BO cấu hình giá/package nhưng chưa công bố → Customer chưa thấy.
6. BO công bố thành công → Customer thấy Facility, UnitType, giá và package đang hiệu lực.
7. BO ngừng giá/package → quote mới không dùng được; giao dịch cũ giữ snapshot.
8. Manager thêm UnitType mới vào Facility đang hoạt động → UnitType mới vẫn ở `AWAITING_PRICING`, không tự xuất hiện với Customer cho đến khi BO đặt giá và công bố bổ sung.

## 3. BE: Facility

Vị trí chính:

- `BE/self-storage-be/src/main/java/com/storagehub/api/facility/FacilityController.java`
- `BE/self-storage-be/src/main/java/com/storagehub/service/FacilityManagementService.java`
- entity/repository/migration Facility liên quan.

Việc cần làm:

1. Tách create và update; `POST` gặp code trùng phải trả 409.
2. Bỏ hành vi xóa toàn bộ UnitType/StorageUnit khi code đã tồn tại.
3. Bổ sung API BO:

```text
POST  /api/business/facilities
PATCH /api/business/facilities/{id}
PATCH /api/business/facilities/{id}/status
```

4. Dùng inactive/maintenance thay cho hard delete khi đã có giao dịch.
5. Bổ sung các trường Facility cần hiển thị thật: description, phone, email, imageUrl, accessHours, securityDescription và các tiện ích cấp cơ sở đã được chốt.
6. Không tự provision S/M/L/XL, StorageUnit và giá/package khi BO chỉ tạo Facility.
7. Ghi audit log và dùng optimistic locking/version cho update.

## 4. BE: UnitType và StorageUnit cho Manager

Vị trí chính:

- entity `UnitType`, `StorageUnit`;
- `UnitTypeController`, `UnitTypeQueryService`;
- các service inventory/maintenance và facility scope.

API cần bổ sung/chuẩn hóa:

```text
GET   /api/manager/facilities/{facilityId}/unit-types
POST  /api/manager/facilities/{facilityId}/unit-types
PATCH /api/manager/unit-types/{unitTypeId}
PATCH /api/manager/unit-types/{unitTypeId}/status

GET   /api/manager/facilities/{facilityId}/storage-units
POST  /api/manager/facilities/{facilityId}/storage-units
PATCH /api/manager/storage-units/{unitId}
PATCH /api/operations/storage-units/{unitId}/status
```

UnitType mục tiêu do Manager quản lý:

```text
code, name, description,
lengthM, widthM, heightM,
maxLoadKg, imageUrl, aisleWidthM,
rackCount, rackLengthM, rackWidthM, rackHeightM,
climateControlled, trolleyType,
smallBoxCapacity, largeBoxCapacity,
status
```

StorageUnit mục tiêu:

```text
unitCode, facilityId, unitTypeId, floor, zone, status, maintenanceReason
```

Không cho xóa UnitType/StorageUnit có reservation, rental, check-in, return hoặc công nợ liên quan.

## 5. BE: giá và tiền cọc do BO quản lý

Giá không nằm trong form kỹ thuật của Manager. Manager chỉ đọc giá hiện hành.

Cần mô hình/API pricing theo:

```text
facilityId + unitTypeId + effective period + version
```

Ví dụ API:

```text
GET  /api/business/facilities/{facilityId}/pricing
POST /api/business/facilities/{facilityId}/pricing
PUT  /api/business/pricing/{pricingId}
```

Mỗi phiên bản lưu:

```text
monthlyPrice, securityDepositAmount,
effectiveFrom, effectiveTo, active, version
```

Không sửa hồi tố record giá đã được dùng; đóng phiên bản cũ và tạo phiên bản mới.

## 6. BE: bộ giảm giá theo nhóm cơ sở

Backend hiện chỉ có RentalPackagePolicy theo một facility. Cần thêm mô hình bộ chính sách:

```text
discount_policy_sets
discount_policy_set_items
facility_discount_policy_assignments
discount_policy_unit_type_assignments (chỉ khi scope=SELECTED)
```

### Policy set

```text
id, code, name, description,
applicationType, version, status,
effectiveFrom, effectiveTo
```

### Items

```text
policySetId, rentalMonths, discountRate, status
```

### Assignment

```text
facilityId, policySetId,
unitTypeScope=ALL|SELECTED,
effectiveFrom, effectiveTo, active, version
```

Quy tắc tối thiểu:

- Một facility chỉ có một bộ mặc định active cho cùng applicationType tại một thời điểm.
- Không cho khoảng hiệu lực chồng nhau; trả 409 khi xung đột.
- `unitTypeScope=ALL` áp dụng cho UnitType hiện tại và được thêm sau này.
- `SELECTED` yêu cầu danh sách unitTypeId đã tồn tại trong cùng facility.
- `applicationType` phải phân biệt `NEW_RESERVATION` và `RENEWAL` (hoặc `BOTH` nếu nghiệp vụ cho phép).

API BO dự kiến:

```text
GET/POST /api/business/discount-policy-sets
GET/PUT/DELETE /api/business/discount-policy-sets/{id}
POST/PUT /api/business/discount-policy-sets/{id}/assignments
GET /api/business/facilities/{facilityId}/discount-policy-set
```

Customer endpoint hiện tại có thể giữ nguyên; backend resolve bộ theo facility, ngày bắt đầu, applicationType và unitType.

## 7. BE: snapshot, hóa đơn và gia hạn

Mọi quote được chấp nhận phải tạo snapshot bất biến:

```text
packagePolicyId, packageCode, packageName, policyVersion,
monthlyPrice, rentalMonths, grossRentalAmount,
discountRate, discountAmount, netRentalAmount,
reservationDepositAmount, securityDepositAmount,
quotedAt
```

Yêu cầu:

- Hóa đơn, hợp đồng, biên nhận, báo cáo và hoàn tiền đọc snapshot.
- Không tính lại giao dịch cũ từ UnitType/pricing/package hiện hành.
- DELETE package/policy set là soft delete.
- Thay đổi 10% thành 15% phải tạo phiên bản mới; bản 10% vẫn truy vết được.

Gia hạn tạo quote/snapshot độc lập. Ví dụ kỳ đầu giảm 10%, gia hạn giảm 15%:

```text
kỳ đầu = oldMonthlyPrice * oldMonths * (1 - 10%)
gia hạn = renewalMonthlyPrice * renewalMonths * (1 - 15%)
```

Không áp 15% ngược về kỳ đầu. Cần chốt và lưu `renewalPriceBasis = CURRENT_PRICE | CONTRACT_PRICE`; khuyến nghị `CURRENT_PRICE`, Customer phải xác nhận quote mới.

## 8. BE/FE: danh mục hàng hóa và Staff review

Vị trí chính:

- FE `src/views/customer/CustomerApp.tsx`;
- FE `src/views/staff/StaffReservationReviews.tsx`;
- BE `ReservationGoodsReviewService` và DTO GoodsCategory.

Việc cần làm:

1. Đưa danh mục hàng hóa thành nguồn chuẩn dùng chung với backend, không để Customer và Staff tự định nghĩa khác nhau.
2. Giữ `OTHER` làm lựa chọn cuối.
3. `OTHER` yêu cầu customGoodsName, mô tả/vật liệu và ảnh theo validation đã chốt.
4. Backend tự đặt `requiresStaffReview=true`, không tin flag từ client.
5. Staff chỉ duyệt trong facility scope OPERATE.
6. Chỉ tạo nghĩa vụ thanh toán cọc sau khi Staff APPROVE.

## 9. FE BO

Vị trí chính:

- `src/views/business/BusinessApp.tsx`
- `src/views/business/facility/UnitAllocationTable.tsx`
- `src/views/business/facility/AddUnitSpecModal.tsx`
- `src/services/facilityApi.ts`

Việc cần làm:

1. Form BO Facility chỉ giữ thông tin cấp Facility; bỏ cấu hình kỹ thuật UnitType/StorageUnit khỏi create/edit Facility.
2. Thay update/delete Context bằng API backend.
3. Không catch lỗi rồi tiếp tục lưu local/báo thành công.
4. Bỏ `storagehub:facility-pricing` và `storagehub:durationDiscounts` khỏi production flow.
5. Xây màn hình pricing chọn Facility → UnitType đã do Manager tạo.
6. Xây màn hình policy set: tạo bộ, items, ngày hiệu lực, gán nhiều cơ sở, ALL/SELECTED unit types và công bố.
7. Hiển thị cảnh báo facility/UnitType đang chờ Manager cấu hình hoặc chờ BO đặt giá.

## 10. FE Manager

Vị trí chính:

- `src/views/manager/ManagerInventoryPanel.tsx`
- `src/views/manager/ManagerUnitEditor.tsx`
- `src/views/manager/ManagerInventoryApiPanel.tsx`
- các service `managerInventoryApi*`.

Việc cần làm:

1. Chuyển create/update UnitType/StorageUnit sang API thật và facility scope MANAGE.
2. Cho Manager chỉnh các thông số kỹ thuật mục tiêu, không cho chỉnh pricing/policy.
3. Giá/cọc/gói hiển thị chỉ đọc.
4. Quản lý trạng thái vật lý theo state transition hợp lệ.
5. Không cho thao tác làm mất liên kết với reservation/rental đang hoạt động.

## 11. FE Customer

Vị trí chính:

- `src/views/customer/CustomerApp.tsx`
- `src/views/customer/customerPresentation.ts`
- `src/services/customerReservationApi.ts`.

Việc cần làm:

1. Chỉ hiển thị Facility/UnitType ACTIVE đã được công bố.
2. Lấy Facility detail, UnitType detail, giá, package và quote từ backend.
3. Xóa hard-code `climate=true`, `security=24/7`, `accessHours=24/7` và ảnh chọn theo mã.
4. Xóa CUSTOMER_UNIT_AMENITIES nếu các trường đó trở thành dữ liệu Manager quản lý.
5. Xóa số đo cửa, UI cửa và kiểm tra kiện lọt qua cửa.
6. Xóa allowedGoods/prohibitedGoods và fallback của chúng khỏi model/UI kho.
7. Không tính giá hoặc discount lại ở API mode; hiển thị server quote.
8. Khi thiếu dữ liệu hiển thị `Chưa cập nhật`, không tự tạo thông tin giả.
9. Refresh/invalidate catalog khi mở detail, đổi facility, đổi ngày thuê hoặc trạng thái inventory thay đổi.

## 12. Migration và tương thích

1. Tạo migration schema trước khi đổi entity.
2. Backfill Facility và UnitType hiện hữu với trạng thái/phien bản phù hợp.
3. Chuyển RentalPackagePolicy hiện hữu sang policy set/assignment hoặc giữ adapter đọc trong giai đoạn chuyển tiếp.
4. Không di chuyển snapshot lịch sử sang giá hiện hành.
5. Loại các cột cửa và allowed/prohibited goods sau khi mọi caller đã được xóa; nếu cần rollout an toàn thì ngừng sử dụng trước, drop cột ở migration sau.

## 13. Kiểm thử bắt buộc

### Phân quyền

- BO không chỉnh thông số kỹ thuật UnitType.
- Manager không chỉnh pricing/discount policy.
- Staff không chỉnh Facility/UnitType/pricing.
- Manager/Staff không truy cập ngoài facility scope.

### Đồng bộ

- Manager thêm UnitType → BO thấy để đặt giá.
- BO đặt giá và gán policy set → Customer thấy sau khi công bố.
- Staff đổi trạng thái unit → availability Customer thay đổi.

### Chính sách

- Hai facility có thể dùng hai policy set khác nhau.
- Một policy set có thể gán nhiều facility.
- Assignment chồng thời gian bị từ chối.
- ALL áp dụng cho UnitType thêm sau; SELECTED chỉ áp dụng đúng IDs.

### Snapshot

- Đơn cũ 10% không đổi khi policy thành 15% hoặc inactive.
- Hóa đơn/hợp đồng/biên nhận dùng số snapshot.
- Gia hạn 15% không sửa kỳ ban đầu 10%.
- Quote hết hạn hoặc pricing/version thay đổi phải requote.

### Hàng hóa

- Category thường đi tiếp theo luồng tự động.
- `OTHER` chuyển PENDING review.
- Staff đúng facility duyệt/từ chối được.
- Chưa duyệt thì không thanh toán cọc.

## 14. Thứ tự triển khai

1. Sửa Facility create/update và bỏ destructive upsert.
2. Tách quyền và API Manager UnitType/StorageUnit.
3. Thêm pricing version theo UnitType.
4. Thêm policy set/items/assignments.
5. Hoàn thiện snapshot và renewal snapshot readers.
6. Nối FE BO với API; bỏ localStorage production flow.
7. Nối FE Manager với API thật.
8. Xóa hard-code và trường bị loại khỏi Customer/model.
9. Chuẩn hóa danh mục hàng hóa và giữ luồng Staff review `OTHER`.
10. Chạy integration test BO → Manager → BO pricing → Customer → Staff.

