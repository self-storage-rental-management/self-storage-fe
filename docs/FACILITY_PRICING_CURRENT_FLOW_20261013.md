# Luồng hiện tại: thông tin kho, gói thuê và giảm giá

Ngày ghi nhận: 2026-10-13  
Phạm vi: FE `self-storage-FE`, BE `self-storage-be`, các vai trò BUSINESS (BO), MANAGER, STAFF và CUSTOMER.

## 1. Mục đích tài liệu

Tài liệu này mô tả đúng code đang tồn tại. Đây không phải thiết kế mục tiêu. Các thay đổi cần thực hiện được ghi riêng tại `FACILITY_PRICING_REQUIRED_CHANGES_20261013.md`.

## 2. Trách nhiệm role theo yêu cầu nghiệp vụ

### BO

- Quản lý cơ sở trên toàn hệ thống.
- Quản lý chính sách thuê, giá, phí, gói thuê và giảm giá.
- Theo dõi báo cáo tổng hợp nhiều cơ sở.

### Manager

- Quản lý loại kho và gian kho trong cơ sở được phân quyền.
- Quản lý thông số kỹ thuật, số lượng, vị trí và trạng thái kho.
- Gán gian vật lý cho reservation, quản lý nhận/trả và gia hạn.
- Code Manager hiện hiển thị giá và chính sách ở chế độ chỉ đọc trong `src/views/manager/ManagerUnitEditor.tsx`.

### Staff

- Xác minh reservation, check-in, bàn giao, trả kho và hỗ trợ khách hàng.
- Cập nhật trạng thái vận hành của gian kho.
- Duyệt hàng hóa `OTHER` (Khác); không quản lý giá, gói thuê hoặc thông số loại kho.

### Customer

- Đọc cơ sở, loại kho, availability và gói thuê từ API khi đã đăng nhập.
- Chọn loại hàng hóa trong danh mục chung.
- Hàng hóa `OTHER` được chuyển Staff duyệt trước khi thanh toán cọc.

## 3. Luồng cơ sở hiện tại

### 3.1 BO tạo cơ sở

`src/views/business/BusinessApp.tsx` gọi `createFacilityApi` trong `src/services/facilityApi.ts`:

```text
POST /api/facilities
```

Payload hiện có:

- code, name, address, city, status;
- danh sách `unitSpecs` gồm sizeCode, name, count, monthlyPrice, lengthM, widthM, heightM, maxLoadKg.

BE `FacilityManagementService` đồng thời:

1. tạo Facility;
2. tạo UnitType;
3. tạo các StorageUnit vật lý;
4. tự provision các gói 1/3/6/12 tháng.

Nếu mã cơ sở đã tồn tại, service hiện xóa unit và unit type cũ rồi tạo lại. Đây là hành vi nguy hiểm đối với cơ sở đã có giao dịch.

FE bắt lỗi tạo backend nhưng vẫn có thể tiếp tục tạo dữ liệu local và hiển thị thành công. Vì vậy BO và Customer có thể nhìn hai trạng thái khác nhau.

### 3.2 BO sửa và xóa cơ sở

- Sửa cơ sở gọi `updateFacility` trong `StorageHubContext`, chưa có API cập nhật Facility tương ứng.
- Xóa cơ sở gọi `deleteFacility` trong Context, chưa xóa/ngừng cơ sở trong database.
- Bảng giá cơ sở lưu tại `localStorage["storagehub:facility-pricing"]`.
- Các thay đổi này không được Customer API nhìn thấy.

### 3.3 Customer đọc danh mục

Customer gọi:

```text
GET /api/facilities?status=active
GET /api/facilities/{facilityId}/unit-types?status=active
GET /api/availability
```

`CustomerApp.tsx` tải lại catalog khoảng mỗi 10 giây. Các dữ liệu lấy đúng từ backend gồm tên/mã/địa chỉ cơ sở, kích thước loại kho, giá tháng, tải trọng, khung kệ và availability.

## 4. Luồng gói thuê và giảm giá hiện tại

### 4.1 BO frontend

Màn hình BO có `DurationDiscountItem` với:

- thời hạn;
- phần trăm giảm đặt mới;
- phần trăm giảm gia hạn;
- trạng thái;
- `scopeType = all | specific`;
- `facilityIds[]`.

BO có thể biểu diễn gói áp dụng toàn bộ hoặc một số cơ sở trên UI, nhưng dữ liệu chỉ lưu tại:

```text
localStorage["storagehub:durationDiscounts"]
```

UI chưa gọi API `/api/business/policies/packages`. Các cấu hình BO này không phải dữ liệu chính thức trong database.

### 4.2 Backend

BE đã có `RentalPackagePolicy` theo từng Facility, gồm:

- facilityId, code, name, rentalMonths;
- discountRate, policyVersion;
- active, effectiveFrom, effectiveTo.

API BO hiện có:

```text
GET    /api/business/policies/packages
POST   /api/business/policies/packages
PUT    /api/business/policies/packages/{id}
DELETE /api/business/policies/packages/{id}
```

`DELETE` là soft delete bằng `active=false`. Đây là hướng đúng để giữ lịch sử.

Mỗi record chỉ thuộc một facility. Backend chưa có thực thể "bộ giảm giá" để tạo một lần rồi gán cho nhiều cơ sở.

### 4.3 Customer

Khi mở form đặt kho, Customer gọi:

```text
GET /api/customer/reservations/rental-packages?facilityId=...&startDate=...
```

Sau khi chọn package, Customer gửi `pricingPackageCode` để tạo quote. BE tính:

```text
subtotal = monthlyPrice * rentalMonths
discountAmount = subtotal * discountRate
totalAfterDiscount = subtotal - discountAmount
reservationDepositAmount = totalAfterDiscount * 40%
securityDepositAmount = monthlyPrice
dueAtCheckIn = totalAfterDiscount - reservationDepositAmount + securityDepositAmount
```

## 5. Snapshot giá hiện tại

BE hiện lưu các dữ liệu chính của báo giá/giao dịch:

- pricingPackageCode, policyVersion;
- monthlyPrice, rentalMonths;
- subtotal/grossRentalAmount;
- discountRate, discountAmount;
- totalAfterDiscount/netRentalAmount;
- các khoản cọc và số tiền còn lại.

Vì vậy việc BO sửa hoặc ngừng package không nên thay đổi reservation/hợp đồng/hóa đơn đã xác nhận. Các màn hình lịch sử phải đọc snapshot, không tính lại từ UnitType hoặc RentalPackagePolicy hiện hành.

## 6. Luồng gia hạn hiện tại

BE có renewal quote và dữ liệu terms riêng, lấy package đang hợp lệ tại thời điểm gia hạn. Gia hạn là giao dịch mới, không sửa snapshot kỳ thuê ban đầu.

Ví dụ:

- kỳ ban đầu 6 tháng giảm 10% giữ nguyên 10%;
- lần gia hạn sau đó 6 tháng giảm 15% chỉ áp dụng cho kỳ gia hạn;
- nếu chính sách đổi tiếp, renewal đã xác nhận vẫn giữ snapshot 15%.

FE vẫn còn một số luồng demo/local tính giảm gia hạn trong `CustomerApp.tsx`; cần loại khỏi production API flow.

## 7. Luồng hàng hóa `Khác`

Customer FE có danh mục hàng hóa cố định và lựa chọn `OTHER`.

Khi có `OTHER`:

1. Customer nhập tên hàng, vật liệu, mô tả, số lượng, kích thước, cân nặng và ảnh;
2. hồ sơ yêu cầu xác minh email;
3. reservation chuyển chờ Staff duyệt;
4. Staff duyệt hoặc từ chối tại `StaffReservationReviews.tsx`;
5. chỉ sau khi được duyệt Customer mới thanh toán cọc.

Luồng này đã tồn tại cả FE và BE (`ReservationGoodsReviewService`). Danh mục hiện được khai báo trực tiếp trong Customer FE, chưa có nguồn danh mục dùng chung.

## 8. Dữ liệu Customer còn hard-code

Customer hiện tự gán hoặc fallback các thông tin:

- climate=true;
- security=`24/7`;
- accessHours=`24/7`;
- ảnh theo mã cơ sở;
- aisle width, sức chứa thùng, loại xe đẩy theo S/M/L/XL;
- danh sách allowed/prohibited goods;
- số đo cửa và logic kiện hàng lọt qua cửa;
- một số kích thước khung hiển thị cố định.

Theo quyết định phạm vi mới, số đo cửa và danh sách hàng cấm/được phép theo từng kho sẽ bị loại bỏ khỏi thiết kế mục tiêu.

## 9. Chồng chéo nghiệp vụ hiện tại

BO hiện có thể cấu hình ngay trong form cơ sở:

- loại và số lượng kho;
- kích thước, tải trọng, lối đi;
- số lượng/kích thước khung;
- giá tháng;
- rental packages theo loại kho.

Phạm vi này chồng lấn đáng kể với nghiệp vụ Manager. Luồng mục tiêu cần tách BO quản lý Facility và thương mại; Manager quản lý cấu hình kỹ thuật UnitType/StorageUnit.

