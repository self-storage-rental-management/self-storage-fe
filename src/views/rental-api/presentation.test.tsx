import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import RentalDetail from "./RentalDetail"
import RenewalDetail from "./RenewalDetail"
import {
  hasRenewalAction,
  rentalDate,
  rentalError,
  rentalMoney,
  unknown,
} from "./presentation"
import { RenewalAttempt, newRenewalIdempotencyKey } from "../../hooks/useRenewalCommand"
import { ApiClientError } from "../../services/apiClient"
import { manager, rental, renewal, quote } from "../../../tests/rentalApiFixtures"

describe("Rental/Renewal business presentation", () => {
  it.each(["active", "ACTIVE"])("translates access status %s without changing its value or exposing credentials", status => {
    const detail = { ...rental, access: { completeness: "COMPLETE", status, reason: "PRIVATE_SOURCE_REASON" } }
    const html = renderToStaticMarkup(<RentalDetail rental={detail} />)
    expect(html).toContain("Đang hoạt động")
    expect(html).not.toContain("PRIVATE_SOURCE_REASON")
    expect(detail.access.status).toBe(status)
  })
  it("labels PARTIAL finance and preserves known balances while deposit remains unknown", () => {
    const html = renderToStaticMarkup(<RentalDetail rental={{ ...rental, financialSummary: {
      ...rental.financialSummary, completeness: "PARTIAL", outstandingAmount: 1234,
      overdueAmount: 234, securityDepositAmount: null, billingMode: "PREPAID_FULL_PERIOD",
      reason: "Chưa xác minh cọc bảo đảm",
    } }} />)
    expect(html).toContain("Đã xác minh một phần")
    expect(html).toContain("1.234 đ")
    expect(html).toContain("234 đ")
    expect(html).not.toContain("Chưa xác minh cọc bảo đảm")
    expect(html).toMatch(/Cọc hồ sơ thuê<\/dt><dd>Chưa có dữ liệu xác thực/)
    expect(html).toContain(unknown)
  })
  it("renders authoritative prepaid financial details without inventing a recurring due date", () => {
    const html=renderToStaticMarkup(<RentalDetail rental={{...rental, financialSummary:{...rental.financialSummary, completeness:"COMPLETE", outstandingAmount:0, overdueAmount:0, securityDepositAmount:1234567, billingMode:"PREPAID_FULL_PERIOD"}}} />)
    expect(html).toContain("1.234.567 đ")
    expect(html).toContain("Trả trước toàn kỳ, không có kỳ thu tiền định kỳ")
    expect(html).not.toContain("API D1 chưa cung cấp")
  })
  it("UNKNOWN financial source does not expose an unverified deposit value", () => {
    const html=renderToStaticMarkup(<RentalDetail rental={{...rental,financialSummary:{...rental.financialSummary,securityDepositAmount:1234567}}} />)
    expect(html).not.toContain("1.234.567 đ")
  })
  it("shows accepted terms and persisted cancellation reason without recalculating", () => {
    const html=renderToStaticMarkup(<RenewalDetail role="customer" renewal={{...renewal,acceptedTerms:quote,cancellationReason:"Khách đổi kế hoạch"}} onAction={()=>{}} />)
    expect(html).toContain("3.201.000 đ")
    expect(html).toContain("12.804.000 đ")
    expect(html).toContain("Khách đổi kế hoạch")
    expect(html).not.toContain("không phải xác nhận đã thanh toán")
    expect(html).not.toContain("policy1")
    expect(html).toContain("Điều khoản khách hàng đã chấp nhận")
  })
  it("legacy renewal has honest missing snapshot state", () => {
    const html=renderToStaticMarkup(<RenewalDetail role="customer" renewal={renewal} onAction={()=>{}} />)
    expect(html).toContain("chưa thể xác định giá và tiền cọc")
    expect(html).not.toContain("catalog")
    expect(html).not.toContain("3.201.000 đ")
  })
  it("generates secure retry keys on LAN HTTP without randomUUID", () => {
    const fill = vi.fn((bytes: Uint8Array) => bytes.fill(42))
    vi.stubGlobal("crypto", { getRandomValues: fill })
    try {
      expect(newRenewalIdempotencyKey()).toBe(`renewal-${"2a".repeat(16)}`)
      expect(fill).toHaveBeenCalledTimes(1)
    } finally { vi.unstubAllGlobals() }
  })
  it.each([100, 26000, 5500000, 9500000, 15000000])(
    "formats applied VND %i without exchange conversion",
    (value) => {
      expect(rentalMoney(value, "VND")).toBe(
        `${value.toLocaleString("vi-VN")} đ`,
      )
    },
  )
  it("UNKNOWN money is not zero", () => {
    expect(rentalMoney(null, "VND")).toBe(unknown)
    expect(rentalMoney(0, "VND")).toBe("0 đ")
  })
  it("keeps LocalDate intact across timezone boundaries", () => {
    expect(rentalDate("2026-10-01")).toBe("01/10/2026")
    expect(rentalDate(null)).toBe(unknown)
  })
  it("uses nested UnitType and hides legal/database/PIN fiction", () => {
    const html = renderToStaticMarkup(<RentalDetail rental={rental} />)
    expect(html).toContain("Small Storage")
    expect(html).toContain("5.500.000 đ")
    expect(html).toContain(unknown)
    expect(html).not.toContain("143.000.000.000")
    expect(html).not.toContain("9004#")
    expect(html).not.toContain("database")
    expect(html).not.toContain("Đã thanh toán")
  })
  it("move-out disables new renewal request", () => {
    expect(
      renderToStaticMarkup(
        <RentalDetail
          rental={{ ...rental, status: "return_requested" }}
          onRequest={() => {}}
        />,
      ),
    ).toContain("disabled")
  })
  it("Manager action needs server action + real version + MANAGE + permission", () => {
    const ready = { ...renewal, acceptedTerms: quote, allowedActions: ["APPROVE" as const],
      financialCheck: { completeness: "COMPLETE", checkedAt: "2026-10-06T00:00:00Z", blockingObligationRefs: [], hasUnresolvedDispute: false } }
    expect(hasRenewalAction(ready, "APPROVE", manager, "manager")).toBe(true)
    expect(
      hasRenewalAction(
        { ...ready, version: null },
        "APPROVE",
        manager,
        "manager",
      ),
    ).toBe(false)
    expect(
      hasRenewalAction(
        ready,
        "APPROVE",
        { ...manager, permissions: ["rentals:read"] },
        "manager",
      ),
    ).toBe(false)
    expect(
      hasRenewalAction(
        ready,
        "APPROVE",
        { ...manager, facilityScopes: { f1: "READ" } },
        "manager",
      ),
    ).toBe(false)
    expect(hasRenewalAction(renewal, "APPROVE", manager, "manager")).toBe(false)
  })
  it("does not approve from UNKNOWN money, missing accepted terms, debt or a dispute even if an action is advertised", () => {
    const ready = { ...renewal, acceptedTerms: quote, allowedActions: ["APPROVE" as const],
      financialCheck: { completeness: "COMPLETE", checkedAt: "2026-10-06T00:00:00Z", blockingObligationRefs: [] as string[], hasUnresolvedDispute: false } }
    for (const record of [
      { ...ready, financialCheck: renewal.financialCheck },
      { ...ready, acceptedTerms: null },
      { ...ready, financialCheck: { ...ready.financialCheck, blockingObligationRefs: ["real-obligation"] } },
      { ...ready, financialCheck: { ...ready.financialCheck, hasUnresolvedDispute: true } },
      { ...ready, reviewState: "UNKNOWN" as const },
    ]) expect(hasRenewalAction(record, "APPROVE", manager, "manager")).toBe(false)
  })
  it("Customer action is owned by UUID, never by display name", () => {
    const customer = { ...manager, id: "c1", roles: ["CUSTOMER" as const] }
    expect(hasRenewalAction(renewal, "CANCEL", customer, "customer")).toBe(true)
    expect(
      hasRenewalAction(
        renewal,
        "CANCEL",
        { ...customer, id: "other" },
        "customer",
      ),
    ).toBe(false)
    expect(hasRenewalAction(renewal, "APPROVE", customer, "customer")).toBe(
      false,
    )
  })
  it("approved does not claim Rental extended or expose fake payment controls", () => {
    const html = renderToStaticMarkup(
      <RenewalDetail
        role="customer"
        renewal={{ ...renewal, status: "approved", allowedActions: [] }}
        onAction={() => {}}
      />,
    )
    expect(html).toContain("Ngày kết thúc thuê chưa thay đổi")
    expect(html).toContain("chờ thanh toán và hoàn tất ký gia hạn")
    expect(html).not.toContain("D3")
    expect(html).not.toContain("Thanh toán ngay")
  })
  it("source missing error is distinct from empty authorized result", () => {
    expect(
      rentalError(
        new ApiClientError("DEFERRED_SOURCE: policy", { status: 409 }),
      ),
    ).toContain("Chưa đủ dữ liệu hoặc chính sách")
  })
  it("retry uses same key, refuses changed payload until outcome is resolved", () => {
    const attempt = new RenewalAttempt()
    const key = attempt.key("same-payload")
    expect(attempt.key("same-payload")).toBe(key)
    expect(() => attempt.key("different")).toThrow()
    attempt.clear()
    expect(attempt.key("different")).not.toBe(key)
  })
})
