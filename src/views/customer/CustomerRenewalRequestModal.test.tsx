import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import CustomerRenewalRequestModal, { formatRenewalOptionLabel } from "./CustomerRenewalRequestModal"
import { ApiClientError } from "../../services/apiClient"

const commandState = vi.hoisted(() => ({
  error: undefined as unknown,
  busy: false,
  uncertain: false,
  conflict: false,
  run: vi.fn(),
  clear: vi.fn(),
  isLocked: vi.fn(() => false),
}))

vi.mock("../../hooks/useRenewalCommand", () => ({
  useRenewalCommand: () => commandState,
}))

vi.mock("../../hooks/useRentalApiResource", () => ({
  useRentalApiResource: () => ({
    data: [
      {
        pricingPackageCode: "PKG_1M",
        pricingPackageName: "Gói 1 tháng",
        rentalMonths: 1,
      },
    ],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
}))

vi.mock("../../services/renewalApi", () => ({
  getRenewalOptions: vi.fn().mockResolvedValue([]),
  listRenewals: vi.fn().mockResolvedValue({ data: [] }),
  quoteRenewal: vi.fn().mockResolvedValue(null),
  reviseRenewal: vi.fn().mockResolvedValue(null),
  submitRenewal: vi.fn().mockResolvedValue(null),
  createRenewalVnpayPaymentIntent: vi.fn().mockResolvedValue(null),
  renewalPaymentRedirectUrl: vi.fn().mockReturnValue(""),
}))

describe("CustomerRenewalRequestModal UI improvement", () => {
  beforeEach(() => {
    commandState.error = undefined
    commandState.busy = false
    commandState.uncertain = false
    commandState.conflict = false
    vi.clearAllMocks()
  })

  it("renders dedicated alert card and clean buttons when open renewal conflict occurs", () => {
    commandState.error = new ApiClientError(
      "Rental already has an open or unresolved legacy renewal",
      { status: 409 },
    )
    commandState.conflict = true

    const modal = (
      <CustomerRenewalRequestModal
        actorId="cust-1"
        rentalId="rent-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onNavigateToRenewals={vi.fn()}
      />
    )

    const html = renderToStaticMarkup(modal)

    // Verify rich alert card is rendered
    expect(html).toContain("Gian kho này đã có yêu cầu gia hạn đang mở")
    expect(html).toContain("Hợp đồng thuê này đã được tạo một yêu cầu gia hạn trước đó")

    // Verify old confusing buttons are gone
    expect(html).not.toContain("Xác nhận và xem yêu cầu")
    expect(html).not.toContain("Đóng và tải lại hồ sơ")

    // Verify clean action buttons
    expect(html).toContain("Đóng")
    expect(html).toContain("Mở tab Yêu cầu gia hạn")
  })

  it("renders standard form and submit button when there is no conflict", () => {
    const modal = (
      <CustomerRenewalRequestModal
        actorId="cust-1"
        rentalId="rent-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onNavigateToRenewals={vi.fn()}
      />
    )

    const html = renderToStaticMarkup(modal)

    // Form elements present
    expect(html).toContain("Gói gia hạn")
    expect(html).toContain("Hủy")
    expect(html).toContain("Xác nhận và xem yêu cầu")

    // Dropdown contains package name with 'Gói gia hạn' and accurate discount percent
    expect(html).toContain("Gói gia hạn 1 tháng (Giảm 0%)")
    expect(html).not.toContain("Gói thuê")

    // No conflict alert card
    expect(html).not.toContain("Gian kho này đã có yêu cầu gia hạn đang mở")
  })

  describe("formatRenewalOptionLabel", () => {
    it("converts 'Gói thuê' into 'Gói gia hạn' and displays discount percentage", () => {
      const label = formatRenewalOptionLabel({
        pricingPackageCode: "PKG_3M",
        pricingPackageName: "Gói thuê 3 tháng",
        rentalMonths: 3,
        discountRate: 0.03,
      })
      expect(label).toBe("Gói gia hạn 3 tháng (Giảm 3%)")
      expect(label).not.toContain("Gói thuê")
    })

    it("converts 'Gói X tháng' into 'Gói gia hạn X tháng' with discount rate", () => {
      const label = formatRenewalOptionLabel({
        pricingPackageCode: "PKG_6M",
        pricingPackageName: "Gói 6 tháng",
        rentalMonths: 6,
        discountRate: 0.05,
      })
      expect(label).toBe("Gói gia hạn 6 tháng (Giảm 5%)")
    })

    it("falls back to default discount percent when discountRate is not provided", () => {
      const label = formatRenewalOptionLabel({
        pricingPackageCode: "PKG_12M",
        rentalMonths: 12,
      })
      expect(label).toBe("Gói gia hạn 12 tháng (Giảm 8%)")
    })

    it("displays Giảm 0% for 1 month package without discount", () => {
      const label = formatRenewalOptionLabel({
        pricingPackageCode: "PKG_1M",
        pricingPackageName: "Gói 1 tháng",
        rentalMonths: 1,
        discountRate: 0,
      })
      expect(label).toBe("Gói gia hạn 1 tháng (Giảm 0%)")
    })
  })
})
