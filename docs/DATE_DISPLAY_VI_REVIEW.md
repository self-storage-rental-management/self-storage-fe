# Thống kê chuẩn hóa ngày/tháng/năm

Ngày thực hiện: 19/10/2026.

## Nguyên nhân

Các ô nhập `date` và `datetime-local` gốc dùng định dạng của trình duyệt, nên có thể hiện tháng/ngày/năm. Không phải tất cả máy đều hiển thị sai. Chỉ đặt thuộc tính ngôn ngữ cho ô nhập không bảo đảm trình duyệt đổi thứ tự ngày và tháng.

Đã tìm thấy 38 vị trí khai báo ô ngày/ngày giờ trong 21 tệp màn hình, gồm các ô dùng thành phần `Input` chung và ô HTML trực tiếp. Ngoài ra có hàm định dạng ngày của quản lý dùng tháng/ngày/năm khi chọn ngôn ngữ tiếng Anh.

## Những vị trí đã xử lý

Đường dẫn dưới đây tính từ `src/views/` của FE. Các trường dùng `Input` nhận thay đổi thông qua thành phần dùng chung, không cần sửa từng màn hình.

| Nhóm | Tệp | Trường ngày/ngày giờ |
|---|---|---|
| Gia hạn | `rental-api/RenewalAppointmentPicker.tsx` | Ngày ký gia hạn mong muốn, bao gồm chọn và đổi lịch |
| Gia hạn | `rental-api/RenewalOperationsPanel.tsx` | Lịch ký đề nghị, hạn ký đề nghị |
| Gia hạn | `staff/StaffRenewalOperationsApiPanel.tsx` | Bộ lọc ngày của nhân viên ký gia hạn |
| Khách hàng | `customer/CustomerApp.tsx` | Các ô ngày trả kho và ngày hẹn ký còn dùng ô ngày gốc |
| Chính sách | `rental-support-integration/DuongPolicyWorkspace.tsx` | Ngày bắt đầu và kết thúc hiệu lực theo loại chính sách đang chọn |
| Kinh doanh | `business/BusinessApp.tsx` | Ô ngày trong biểu mẫu chính sách |
| Kinh doanh | `business/BusinessDamageIncidentsPanel.tsx` | Ngày giờ phát sinh sự cố |
| Kinh doanh | `business/BusinessReturnsPanel.tsx` | Ô ngày của hồ sơ trả kho |
| Quản lý | `manager/ManagerInventoryDetails.tsx` | Các ô ngày trong chi tiết kho |
| Quản lý | `manager/ManagerApiStaffTasksPanel.tsx` | Hạn xử lý nhiệm vụ |
| Quản lý | `manager/ManagerStaffTasksPanel.tsx` | Ngày đến hạn, hạn xử lý |
| Quản lý | `manager/ManagerPaymentsPanel.tsx` | Giao dịch từ ngày, đến ngày |
| Quản lý | `manager/ManagerReportsPanel.tsx` | Nhật ký từ ngày, đến ngày |
| Quản lý | `manager/ManagerReturnsPanel.tsx` | Lọc ngày hẹn, ngày nghiệm thu, hạn bảo trì |
| Nhân viên | `staff/StaffDailyTaskQueue.tsx` | Lọc ngày đến hạn |
| Nhân viên | `staff/StaffCheckInOperationsPanel.tsx` | Các ô lọc ngày nhận kho |
| Nhân viên | `staff/StaffApp.tsx` | Các ô ngày trong màn hình nghiệp vụ nhân viên |
| Nhân viên | `staff/StaffSupportPanel.tsx` | Ô ngày của màn hình hỗ trợ |
| Quản trị | `admin/AdminActivityApiPanel.tsx` | Nhật ký từ ngày, đến ngày |
| Quản trị | `admin/AdminLoginHistoryApiPanel.tsx` | Lịch sử đăng nhập từ ngày, đến ngày |
| Hàm hiển thị | `manager/managerI18n.ts` | Ngày và ngày giờ, kể cả khi chuyển ngôn ngữ |

## Cách sửa

- Ô ngày hiển thị `dd/mm/yyyy`; ô ngày giờ hiển thị `dd/mm/yyyy HH:mm` và giữ giây nếu giá trị có giây.
- Dùng chung `src/components/LocalizedDateInput.tsx`, có nút mở lịch chọn ngày. Giữ các điều kiện bắt buộc, giới hạn ngày và trạng thái khóa của từng trường.
- `src/components/ui.tsx` tự áp dụng cho các trường `Input` có loại ngày/ngày giờ. Các ô HTML trực tiếp và ô ngày hiệu lực động cũng dùng cùng thành phần.
- Giữ dữ liệu biểu mẫu và API ở dạng ISO `yyyy-mm-dd` hoặc `yyyy-mm-ddTHH:mm`; không đổi giá trị ngày thực tế hoặc hợp đồng API.
- Các ô nhận/trả kho đã dùng `VietnameseDateInput` tiếp tục dùng ngày/tháng/năm.
- Các chỗ hiển thị đã dùng tiếng Việt không cần đổi sang định dạng khác. Không đổi các chuỗi ISO dùng làm giá trị lọc, lưu trữ hoặc tính toán.

## Phạm vi

- Chỉ sửa FE, không sửa BE hoặc database.
- Không thay đổi chính sách lịch hẹn, thời hạn thanh toán hoặc quy tắc tính ngày.
- Chưa chạy kiểm thử tự động trong lượt sửa này.
- Kiểm tra kiểu dữ liệu bằng `npm run typecheck`: thành công.
