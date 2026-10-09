import { Button, Card, StatCard } from "../../components/ui"
import { Icon } from "../../components/Layout"
import { ApiClientError } from "../../services/apiClient"
import { getAuthenticatedActor } from "../../services/authApi"
import { listRentals } from "../../services/rentalApi"
import { listSupportTickets } from "../../services/supportApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"

type Metric = "active-rentals" | "open-support"

/** Server totals, not the length of a page or the demo Context. */
export async function loadCustomerApiCount(metric: Metric, customerId: string) {
  const page = metric === "active-rentals"
    ? await listRentals("customer", { status: "active", page: 0, size: 1 })
    : await listSupportTickets("customer", { status: "open", page: 0, size: 1 })
  if (!page.data.every(record => "customerId" in record
    ? record.customerId === customerId
    : record.customer.id === customerId)) {
    throw new ApiClientError("Dữ liệu không thuộc tài khoản đang đăng nhập.", { code: "INVALID_RESPONSE" })
  }
  return page.pagination.totalItems
}

export function CustomerApiMetric({ metric }: { metric: Metric }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== "ACTIVE" || !actor.roles.includes("CUSTOMER")) {
    return <MetricValue metric={metric} />
  }
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}:${metric}`
  return <CustomerMetricSession key={identity} metric={metric} identity={identity} customerId={actor.id} />
}

function CustomerMetricSession({ metric, identity, customerId }: { metric: Metric; identity: string; customerId: string }) {
  const read = useRentalApiResource(identity, () => loadCustomerApiCount(metric, customerId))
  return <div>
    <MetricValue metric={metric} value={read.loading ? "…" : read.error ? undefined : read.data} />
    {!!read.error && <p role="status" className="mt-1 text-xs text-amber-800">Chưa xác minh được số liệu. Xem chi tiết tại trang {metric === "active-rentals" ? "Hồ sơ thuê & Gia hạn" : "Hỗ trợ khách hàng"}.</p>}
  </div>
}

function MetricValue({ metric, value }: { metric: Metric; value?: number | string }) {
  return <StatCard title={metric === "active-rentals" ? "Hồ sơ thuê đang hoạt động" : "Yêu cầu hỗ trợ đang mở"}
    value={value ?? "Chưa xác minh"} icon={metric === "active-rentals" ? Icon.key : Icon.support} />
}

/** Keep the teammate Return/receipt card unchanged in demo mode. */
export function CustomerRentalApiLink({ onOpen }: { onOpen: () => void }) {
  return <Card className="space-y-3 p-5">
    <h2 className="font-bold text-stone-900">Hồ sơ thuê & Gia hạn</h2>
    <Button variant="outline" onClick={onOpen}>Xem hồ sơ thuê & Gia hạn</Button>
  </Card>
}
