import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { rental, quote } from "../../../tests/rentalApiFixtures"
import { isRentalRecord } from "../../services/rentalApi"
import { isRenewalRecord } from "../../services/renewalApi"
import { renewal } from "../../../tests/rentalApiFixtures"
import type { RentalApiDetail } from "../../types/rentalApi"
import RentalDetail from "./RentalDetail"
import { rentalPeriodText } from "./presentation"

const exclusive: RentalApiDetail = {
  ...rental, startDate: "2026-10-01", contractEndDate: "2026-11-01",
  dateSemantics: { completeness: "COMPLETE", convention: "EXCLUSIVE", lastPermittedDate: "2026-10-31", endExclusive: "2026-11-01" },
}
describe("P03 canonical period FE compatibility", () => {
  it("renders all rental detail field labels in bold without changing their data", () => {
    const html = renderToStaticMarkup(<RentalDetail rental={exclusive} />)
    const labels = Array.from(html.matchAll(/<dt class="font-bold">([^<]+)<\/dt>/g), match => match[1])
    expect(labels).toEqual([
      "Mã hồ sơ thuê", "Khách hàng", "Cơ sở / Gian kho", "Loại gian kho",
      "Trạng thái", "Thời hạn sử dụng", "Trạng thái truy cập",
      "Tình trạng tài chính", "Hạn nghĩa vụ thanh toán kế tiếp", "Dư nợ / Quá hạn",
    ])
    expect(html).toContain("Theo dõi quá hạn")
    expect(html).not.toContain("Đơn giá áp dụng / tháng")
    expect(html).not.toContain("Cọc theo thỏa thuận ban đầu")
    expect(html).toContain(exclusive.id)
    expect(html).toContain(exclusive.customer.fullName)
    const unknownHtml = renderToStaticMarkup(<RentalDetail rental={{ ...exclusive, dateSemantics: null }} />)
    expect(unknownHtml).toContain('<dt class="font-bold">Ngày thuê đang lưu</dt>')
  })
  it("uses the verified last permitted day, not the raw exclusive marker", () => {
    expect(isRentalRecord(exclusive)).toBe(true)
    const html = renderToStaticMarkup(<RentalDetail rental={exclusive} />)
    expect(html).toContain("Thời hạn sử dụng")
    expect(html).toContain("31/10/2026")
    expect(html).not.toContain("01/11/2026")
    expect(exclusive.contractEndDate).toBe("2026-11-01")
  })
  it("inclusive and exclusive records with the same coverage show identical intervals", () => {
    const inclusive: RentalApiDetail = { ...exclusive, contractEndDate: "2026-10-31", dateSemantics: { ...exclusive.dateSemantics!, convention: "INCLUSIVE" } }
    expect(isRentalRecord(inclusive)).toBe(true)
    expect(rentalPeriodText(inclusive)).toBe(rentalPeriodText(exclusive))
  })
  it.each([undefined, null, { completeness: "UNKNOWN", convention: null, lastPermittedDate: null, endExclusive: null }] as const)("keeps legacy/unknown dates explicitly unverified: %j", dateSemantics => {
    const record = { ...exclusive, dateSemantics }
    expect(isRentalRecord(record)).toBe(true)
    const html = renderToStaticMarkup(<RentalDetail rental={record} />)
    expect(html).toContain("Ngày thuê đang lưu")
    expect(html).toContain("chưa xác minh ngày cuối sử dụng")
    expect(html).toContain("01/11/2026")
    expect(html).not.toContain("Thời hạn sử dụng")
  })
  it("can show the stored period without exposing the technical date warning", () => {
    const legacy = { ...exclusive, dateSemantics: null }
    expect(rentalPeriodText(legacy, false)).toBe("01/10/2026 → 01/11/2026")
    const html = renderToStaticMarkup(<RentalDetail rental={legacy} showTechnicalWarnings={false} />)
    expect(html).toContain("Thời hạn sử dụng")
    expect(html).not.toContain("chưa xác minh ngày cuối sử dụng")
    expect(html).not.toContain("Cần kiểm tra dữ liệu")
  })
  it.each([
    { lastPermittedDate: "2026-11-01" }, { convention: "INCLUSIVE" },
    { endExclusive: "2026-11-02" }, { completeness: "UNKNOWN" },
    { convention: null }, { lastPermittedDate: "2026-02-30" },
  ])("rejects contradictory canonical response rather than presenting verified dates: %j", fields => {
    expect(isRentalRecord({ ...exclusive, dateSemantics: { ...exclusive.dateSemantics, ...fields } })).toBe(false)
  })
  it("reads new quote metadata while keeping old/new date and money meanings unchanged", () => {
    const terms = { ...quote, oldEndDate: "2026-11-01", extensionStartDate: "2026-11-01", endDateConvention: "EXCLUSIVE", rentalStartDate: "2026-10-01" }
    const record = { ...renewal, oldEndDate: terms.oldEndDate, amount: terms.totalAfterDiscount, acceptedTerms: terms }
    expect(isRenewalRecord(record)).toBe(true)
    expect(isRenewalRecord({ ...record, acceptedTerms: { ...terms, endDateConvention: "INCLUSIVE" } })).toBe(false)
    expect(isRenewalRecord({ ...record, acceptedTerms: { ...terms, rentalStartDate: null } })).toBe(false)
    expect(isRenewalRecord({ ...record, acceptedTerms: { ...terms, rentalStartDate: "2026-02-30" } })).toBe(false)
    expect(record.acceptedTerms.totalAfterDiscount).toBe(quote.totalAfterDiscount)
  })
})
