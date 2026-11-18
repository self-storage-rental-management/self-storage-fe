import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import CustomerRenewalRequestModal from "./CustomerRenewalRequestModal"
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

    // No conflict alert card
    expect(html).not.toContain("Gian kho này đã có yêu cầu gia hạn đang mở")
  })
})
