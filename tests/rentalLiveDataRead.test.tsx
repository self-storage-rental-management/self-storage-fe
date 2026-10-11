import { afterEach, describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { clearAuthTokens, setAccessToken } from "../src/services/apiClient"
import { getRental, listRentals } from "../src/services/rentalApi"
import RentalDetail from "../src/views/rental-api/RentalDetail"

// Explicit opt-in, existing local records only. Login creates normal test sessions; no business POSTs.
const enabled = process.env.STORAGEHUB_TEST_LIVE_READ === "1"
describe.skipIf(!enabled)("Local real API → existing DB → rental response → FE render", () => {
  afterEach(() => clearAuthTokens())
  it.each(["customer", "manager"] as const)("%s detail uses actual DB evidence without promoting simulation", async role => {
    const base = import.meta.env.VITE_API_BASE_URL
    expect(["http://localhost:8081", "http://127.0.0.1:8081"]).toContain(base)
    const prefix = `STORAGEHUB_TEST_${role.toUpperCase()}`
    const email = process.env[`${prefix}_EMAIL`]
    const password = process.env[`${prefix}_PASSWORD`]
    if (!email || !password) throw new Error("Missing local test credentials")
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    })
    expect(login.status).toBe(200)
    const auth = await login.json()
    setAccessToken(auth.data.accessToken)
    const page = await listRentals(role, { page: 0, size: 10 })
    expect(page.data.length).toBeGreaterThan(0)
    const detail = await getRental(role, page.data[0].id)
    expect(detail.bookingEvidence?.rentalId).toBe(detail.id)
    expect(detail.bookingEvidence?.reservationId).toBe(detail.reservationId)
    expect(detail.bookingEvidence?.agreedAmounts).not.toBeNull()
    expect(detail.dateSemantics?.convention).toBe("INCLUSIVE")
    expect(detail.dateSemantics?.lastPermittedDate).toBe(detail.contractEndDate)
    expect(detail.financialSummary.completeness).toBe("UNKNOWN")
    expect(detail.access.completeness).toBe("UNKNOWN")
    const html = renderToStaticMarkup(<RentalDetail rental={detail} />)
    expect(html).toContain("Thời hạn sử dụng")
    expect(html).toContain("Cọc bảo đảm theo thỏa thuận")
    expect(html).toContain("Chưa có dữ liệu xác thực")
    expect(html).not.toContain("chưa xác minh ngày cuối sử dụng")
    expect(html).not.toMatch(/SIMULATED|RESERVATION_DEPOSIT|UNVERIFIED|gatewayIntent|idempotencyKey/)
    if (detail.bookingEvidence?.payments.some(payment => payment.verification === "SIMULATED"))
      expect(html).toContain("Thanh toán thử nghiệm - không thu tiền thật")
  })
})
