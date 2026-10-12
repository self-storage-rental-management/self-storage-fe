import { type NavItem } from "../../components/Layout"

// Hồ sơ thuê API dùng chung một mục điều hướng với các thao tác trả kho và biên nhận.
export const CUSTOMER_RENTAL_API_PAGE = "rental-renewals"

export function customerRentalApiNav(apiAuthenticated: boolean): NavItem[] {
  // Giữ hàm để các liên kết cũ không bị lỗi, nhưng không tạo mục thứ hai trên thanh điều hướng.
  void apiAuthenticated
  return []
}
