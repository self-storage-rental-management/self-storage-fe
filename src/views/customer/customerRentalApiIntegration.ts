import { Icon, type NavItem } from "../../components/Layout"

// D1–D4 is additive: never replace the team's rental-records/Return UI.
export const CUSTOMER_RENTAL_API_PAGE = "rental-renewals"

export function customerRentalApiNav(apiAuthenticated: boolean): NavItem[] {
  return apiAuthenticated ? [{
    id: CUSTOMER_RENTAL_API_PAGE,
    label: "Hồ sơ thuê & Gia hạn",
    icon: Icon.calendar,
    group: "Kho của tôi",
    permission: "rentals:read",
  }] : []
}
