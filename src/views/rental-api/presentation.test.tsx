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
import { manager, rental, renewal } from "../../../tests/rentalApiFixtures"

describe("Rental/Renewal business presentation", () => {
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
    const ready = { ...renewal, allowedActions: ["APPROVE" as const] }
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
        { ...manager, permissions: ["view_rentals"] },
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
    expect(html).toContain("không tự thay đổi")
    expect(html).toContain("Chưa có tích hợp thanh toán D3")
    expect(html).not.toContain("Thanh toán ngay")
  })
  it("source missing error is distinct from empty authorized result", () => {
    expect(
      rentalError(
        new ApiClientError("DEFERRED_SOURCE: policy", { status: 409 }),
      ),
    ).toContain("Chưa có nguồn dữ liệu")
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
