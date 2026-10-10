import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationAcknowledgementControl } from "./SupportNotificationReceipts"
import { ids, instant } from "../../../tests/rentalOperationsApiFixtures"

describe("Customer notification acknowledgement presentation", () => {
  it.each([null, { notificationId: ids.event, status: "UNTRACKED" as const, acknowledgementAllowed: false, receivedAt: null }])(
    "unknown/untracked notifications do not offer an invalid command", state => {
      const html = renderToStaticMarkup(<NotificationAcknowledgementControl state={state} busy={false} onAcknowledge={vi.fn()} />)
      expect(html).not.toContain("<button")
      expect(html).not.toContain("Đã xác nhận nhận thông báo")
    },
  )
  it("only a verified available notification offers acknowledgement, disabled while busy", () => {
    const state = { notificationId: ids.event, status: "AVAILABLE" as const, acknowledgementAllowed: true, receivedAt: null }
    const html = renderToStaticMarkup(<NotificationAcknowledgementControl state={state} busy onAcknowledge={vi.fn()} />)
    expect(html).toContain("Xác nhận đã nhận thông báo")
    expect(html).toMatch(/<button[^>]*disabled=""/)
  })
  it("persisted receipt survives reopening without implying ticket closure", () => {
    const html = renderToStaticMarkup(<NotificationAcknowledgementControl state={{ notificationId: ids.event, status: "ACKNOWLEDGED", acknowledgementAllowed: false, receivedAt: instant }} busy={false} onAcknowledge={vi.fn()} />)
    expect(html).toContain("Đã xác nhận nhận thông báo")
    expect(html).toContain("không đóng yêu cầu hỗ trợ")
    expect(html).not.toContain("<button")
  })
})
