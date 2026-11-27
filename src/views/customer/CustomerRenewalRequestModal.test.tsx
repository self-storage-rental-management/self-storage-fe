import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import CustomerRenewalRequestModal, { renewalOptionLabel } from "./CustomerRenewalRequestModal"
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
        pricingPackageName: "Gói thuê 1 tháng",
        rentalMonths: 1,
        discountRate: 0,
      },
      { pricingPackageCode: "LOYAL", pricingPackageName: "Khách thân thiết", rentalMonths: 6, discountRate: 0.0725 },
      { pricingPackageCode: "PKG_6M", pricingPackageName: "  ", rentalMonths: 6, discountRate: 0.105 },
      { pricingPackageCode: "LEGACY", rentalMonths: 12 },
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

  it('shows the blocked reason inside the dialog and disables every renewal control', () => {
    const reason = 'Hồ sơ đang chờ trả kho do kiểm kê sai lệch nên không thể gia hạn.'
    const html = renderToStaticMarkup(<CustomerRenewalRequestModal
      actorId="cust-1" rentalId="rent-1" blockedReason={reason} onClose={vi.fn()} onSuccess={vi.fn()}
    />)
    expect(html).toContain(reason)
    expect(html).toMatch(/<fieldset[^>]*disabled=""[^>]*aria-describedby="renewal-blocked-reason"/)
    expect(html).toMatch(/<select[^>]*disabled=""/)
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*type="checkbox"/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận và xem yêu cầu<\/button>/)
    const cancel = html.match(/<button[^>]*>Hủy<\/button>/)?.[0]
    expect(cancel).toBeDefined()
    expect(cancel).not.toContain('disabled=""')
    expect(html).not.toContain('PKG_1M')
    expect(html).not.toContain('Lấy báo giá mới')
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
    expect(html).toContain("Vui lòng xem hoặc thanh toán yêu cầu hiện có trước khi tạo yêu cầu mới.")

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
    expect(html).toMatch(/<button[^>]*class="[^"]*renewal-confirm-button[^"]*"[^>]*disabled=""[^>]*>Xác nhận và xem yêu cầu<\/button>/)

    // Dropdown contains package name with 'Gói gia hạn' and accurate discount percent
    expect(html).toContain("Gói gia hạn 1 tháng, giảm 0%")
    expect(html).not.toContain("Gói thuê")

    // No conflict alert card
    expect(html).not.toContain("Gian kho này đã có yêu cầu gia hạn đang mở")
  })

  it("shows each package's own discount and renewal name before a quote is selected", () => {
    const html = renderToStaticMarkup(
      <CustomerRenewalRequestModal actorId="cust-1" rentalId="rent-1" onClose={vi.fn()} onSuccess={vi.fn()} />,
    )
    expect(html).toContain('<option value="PKG_1M">Gói gia hạn 1 tháng, giảm 0%</option>')
    expect(html).toContain('<option value="LOYAL">Khách thân thiết, giảm 7,25%</option>')
    expect(html).toContain('<option value="PKG_6M">Gói gia hạn 6 tháng, giảm 10,5%</option>')
    expect(html).toContain('<option value="LEGACY">Gói gia hạn 12 tháng</option>')
    expect(html).not.toContain("Gói thuê")
  })

  it("offers only shorter packages supplied by the backend for a booking conflict", () => {
    commandState.conflict = true
    commandState.error = new ApiClientError("Ô kho đã có lịch đặt trùng", {
      status: 409,
      details: { reason: "RENEWAL_BOOKING_CONFLICT", shorterPackageCodes: ["PKG_1M"] },
    })
    const html = renderToStaticMarkup(
      <CustomerRenewalRequestModal actorId="cust-1" rentalId="rent-1" onClose={vi.fn()} onSuccess={vi.fn()} onBrowseUnits={vi.fn()} />,
    )
    expect(html).toContain("Bạn có thể chọn gói ngắn hơn")
    expect(html).not.toContain("Tìm ô kho khác")
    expect(html).not.toContain("Tải lại hồ sơ")
  })

  it("offers the warehouse browser when no shorter package fits", () => {
    commandState.conflict = true
    commandState.error = new ApiClientError("Ô kho đã có lịch đặt trùng", {
      status: 409,
      details: { reason: "RENEWAL_BOOKING_CONFLICT", shorterPackageCodes: [] },
    })
    const html = renderToStaticMarkup(
      <CustomerRenewalRequestModal actorId="cust-1" rentalId="rent-1" onClose={vi.fn()} onSuccess={vi.fn()} onBrowseUnits={vi.fn()} />,
    )
    expect(html).toContain("Tìm ô kho khác")
    expect(html).not.toContain("Bạn có thể chọn gói ngắn hơn")
  })
})
