import { useState } from "react"
import { Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { listRenewalAppointments } from "../../services/renewalOperationsApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RenewalAppointmentQuery } from "../../types/renewalOperationsApi"
import ApiPager from "../rental-api/ApiPager"
import RenewalOperationsPanel, {
  operationsInputClass,
} from "../rental-api/RenewalOperationsPanel"
import { phaseLabels } from "../rental-api/operationsPresentation"
import { rentalDate } from "../rental-api/presentation"
import { staffErrorMessage } from "./staffPresentation"

export default function StaffRenewalOperationsApiPanel() {
  return <StaffRenewalWorkspace />
}
function StaffRenewalWorkspace() {
  const actor = getAuthenticatedActor()
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes("STAFF") ||
    !Object.values(actor.facilityScopes).some(
      (v) => v === "OPERATE" || v === "MANAGE",
    )
  )
    return (
      <Card className="p-5">
        Tài khoản nhân viên chưa được cấp quyền vận hành tại cơ sở.
        Vui lòng liên hệ quản lý để kiểm tra phân công.
      </Card>
    )
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
  return <StaffSession key={identity} identity={identity} />
}
function StaffSession({ identity }: { identity: string }) {
  const actor = getAuthenticatedActor()!
  const [query, setQuery] = useState<RenewalAppointmentQuery>({
    page: 0,
    size: 20,
  })
  const [selected, setSelected] = useState<string>()
  const [locked, setLocked] = useState(false)
  const read = useRentalApiResource(
    `${identity}:${JSON.stringify(query)}`,
    () => listRenewalAppointments(query),
  )
  const change = (patch: RenewalAppointmentQuery) => {
    setQuery((q) => ({ ...q, ...patch, page: 0 }))
    setSelected(undefined)
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ký gia hạn tại cơ sở (D3)</h1>
      <p className="text-sm text-stone-500">
        Chỉ hiển thị hồ sơ được phân công và thuộc cơ sở bạn được
        phép vận hành.
      </p>
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <label>
          Cơ sở
          <select
            className={operationsInputClass}
            value={query.facilityId || ""}
            onChange={(e) =>
              change({ facilityId: e.target.value || undefined })
            }
          >
            <option value="">Các cơ sở được vận hành</option>
            {Object.entries(actor.facilityScopes)
              .filter(([, scope]) => scope === "OPERATE" || scope === "MANAGE")
              .map(([id]) => (
                <option key={id} value={id}>
                  {actor.facilityNames?.[id] || id}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ngày hẹn (Việt Nam)
          <input
            className={operationsInputClass}
            type="date"
            value={query.date || ""}
            onChange={(e) => change({ date: e.target.value || undefined })}
          />
        </label>
        <label>
          Trạng thái
          <select
            className={operationsInputClass}
            value={query.status || ""}
            onChange={(e) =>
              change({
                status: (e.target.value ||
                  undefined) as RenewalAppointmentQuery["status"],
              })
            }
          >
            <option value="">Tất cả</option>
            {(["SIGNING", "SIGNING_EXPIRED", "COMPLETED"] as const).map((v) => (
              <option key={v} value={v}>
                {phaseLabels[v]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số hồ sơ
          <select
            className={operationsInputClass}
            value={query.size}
            onChange={(e) => change({ size: Number(e.target.value) })}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/trang
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={read.refresh}>
          Tải lại
        </Button>
      </Card>
      {read.loading && (
        <p role="status" className="p-4 text-stone-500">
          Đang tải dữ liệu…
        </p>
      )}
      {Boolean(read.error) && (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p>{staffErrorMessage(read.error, "Không thể tải lịch gia hạn.")}</p>
          <Button variant="outline" onClick={read.refresh}>
            Tải lại
          </Button>
        </div>
      )}
      {read.data && (
        <Card className="p-4 space-y-3">
          {read.data.data.map((s) => (
            <div
              key={s.renewalId}
              className="flex flex-wrap justify-between gap-3 rounded border p-3"
            >
              <div className="text-sm space-y-1 min-w-0">
                <p className="break-all">Gia hạn: {s.renewalId}</p>
                <p>{phaseLabels[s.phase]}</p>
                <p>
                  {rentalDate(s.appointmentStart)} →{" "}
                  {rentalDate(s.appointmentEnd)}
                </p>
                <p>Hạn ký: {rentalDate(s.effectiveSigningDeadline)}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelected(s.renewalId)}
              >
                Xử lý
              </Button>
            </div>
          ))}
          {read.data.data.length === 0 && (
            <p>Không có lịch phù hợp với phân công hiện tại.</p>
          )}
          <ApiPager
            pagination={read.data.pagination}
            onPage={(page) => setQuery((q) => ({ ...q, page }))}
          />
        </Card>
      )}
      {selected && (
        <Modal
          open
          size="xl"
          title="Xử lý ký gia hạn — Nhân viên"
          onClose={() => {
            if (!locked) setSelected(undefined)
          }}
        >
          <RenewalOperationsPanel
            key={`${identity}:${selected}`}
            role="staff"
            id={selected}
            onLocked={setLocked}
            onChanged={read.refresh}
          />
        </Modal>
      )}
    </div>
  )
}
