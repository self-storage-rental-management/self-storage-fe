import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { rental } from "../../../tests/rentalApiFixtures"
import type { RentalBookingEvidence } from "../../types/rentalApi"
import { isRentalBookingEvidence } from "../../services/rentalBookingEvidence"
import { apiRequest } from "../../services/apiClient"
import { getRental } from "../../services/rentalApi"
import RentalDetail from "./RentalDetail"

vi.mock("../../services/apiClient", async importOriginal => ({
  ...await importOriginal<typeof import("../../services/apiClient")>(), apiRequest: vi.fn(),
}))
const evidence: RentalBookingEvidence = {
  rentalId: rental.id, reservationId: rental.reservationId!, currency: "VND",
  agreedAmounts: { netRentalAmount: 100, reservationDepositAmount: 20, securityDepositAmount: 10,
    remainingRentalAmount: 80, dueAtCheckIn: 90, totalInitialObligation: 110 },
  payments: [{ id: "p1", purpose: "RESERVATION_DEPOSIT", status: "PAID", amount: 20,
    processedAt: "2026-10-10T00:00:00Z", verification: "SIMULATED" }], paymentsTruncated: false,
}
beforeEach(() => vi.clearAllMocks())
describe("Booking evidence connects DB response without financial or permission shortcuts", () => {
  it("reads the existing endpoint and preserves unknown debt/access despite a paid simulated record", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { ...rental, bookingEvidence: evidence } })
    const detail = await getRental("customer", rental.id)
    expect(apiRequest).toHaveBeenCalledWith("/api/customer/rental-records/r1")
    expect(detail.bookingEvidence).toEqual(evidence)
    expect(detail.financialSummary.completeness).toBe("UNKNOWN")
    expect(detail.financialSummary.outstandingAmount).toBeNull()
    expect(detail.access.status).toBeNull()
  })
  it("shows agreed amounts separately and does not present a simulation as actual money", () => {
    const html = renderToStaticMarkup(<RentalDetail rental={{ ...rental, bookingEvidence: evidence }} />)
    expect(html).toContain("Cọc bảo đảm theo thỏa thuận")
    expect(html).toContain("không phải xác nhận đã thu tiền hoặc dư nợ hiện tại")
    expect(html).toContain("Thanh toán thử nghiệm - không thu tiền thật")
    expect(html).toContain("Chưa có dữ liệu xác thực")
    expect(html).not.toMatch(/SIMULATED|RESERVATION_DEPOSIT|UNVERIFIED|FileAsset|gatewayIntent/)
  })
  it("renders no-source states without manufacturing zero or changing a legacy response", async () => {
    const empty = { ...evidence, agreedAmounts: null, payments: [] }
    expect(isRentalBookingEvidence(empty, rental.id, rental.reservationId)).toBe(true)
    const html = renderToStaticMarkup(<RentalDetail rental={{ ...rental, bookingEvidence: empty }} />)
    expect(html.match(/Không có dữ liệu/g)).toHaveLength(2)
    expect(html).not.toContain("Thanh toán thử nghiệm")
    vi.mocked(apiRequest).mockResolvedValue({ data: rental })
    expect(await getRental("manager", rental.id)).toEqual(rental)
    expect(renderToStaticMarkup(<RentalDetail rental={rental} />)).not.toContain("Thỏa thuận ban đầu")
  })
  it("non-simulated PAID is still not a verified receipt", () => {
    const unverified = { ...evidence, payments: [{ ...evidence.payments[0], verification: "UNVERIFIED" as const }] }
    expect(renderToStaticMarkup(<RentalDetail rental={{ ...rental, bookingEvidence: unverified }} />))
      .toContain("Chưa có bằng chứng xác minh tiền thực nhận")
  })
  it.each([
    { rentalId: "other" }, { reservationId: "other" }, { currency: "USD" },
    { agreedAmounts: { ...evidence.agreedAmounts!, totalInitialObligation: 0 } },
    { agreedAmounts: { ...evidence.agreedAmounts!, securityDepositAmount: -1 } },
    { payments: [{ ...evidence.payments[0], verification: "VERIFIED_BANK" }] },
    { payments: [{ ...evidence.payments[0], status: "delivered" }] },
    { payments: [{ ...evidence.payments[0], amount: NaN }] },
    { payments: [{ ...evidence.payments[0], processedAt: "invalid" }] },
    { payments: [evidence.payments[0], evidence.payments[0]] }, { paymentsTruncated: true },
  ])("rejects foreign/contradictory source data: %j", async fields => {
    const broken = { ...evidence, ...fields }
    expect(isRentalBookingEvidence(broken, rental.id, rental.reservationId)).toBe(false)
    vi.mocked(apiRequest).mockResolvedValue({ data: { ...rental, bookingEvidence: broken } })
    await expect(getRental("customer", rental.id)).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
  })
  it("keeps API errors as errors, never uses a fallback booking response", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("unavailable"))
    await expect(getRental("customer", rental.id)).rejects.toThrow("unavailable")
  })
})
