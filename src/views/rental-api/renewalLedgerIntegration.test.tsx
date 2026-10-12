import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import RenewalDetail from "./RenewalDetail"
import { renewal } from "../../../tests/rentalApiFixtures"

vi.mock("../rental-support-integration/LedgerPanel", () => ({
  default: ({ role, id }: { role: string; id: string }) => <div data-ledger-role={role} data-ledger-rental={id} />,
}))

it.each(["customer", "manager"] as const)("routes %s Renewal financial readback to its authoritative Rental", role => {
  const html = renderToStaticMarkup(<RenewalDetail role={role} renewal={{ ...renewal, status: "approved", version: 7 }} onAction={() => {}} />)
  expect(html).toContain(`data-ledger-role="${role}"`)
  expect(html).toContain(`data-ledger-rental="${renewal.rentalId}"`)
  expect(html).not.toContain(`data-ledger-rental="${renewal.id}"`)
})
