import { useManagerPresentation } from "../manager/managerPresentation"
import { getAuthenticatedActor } from "../../services/authApi"
import { listSupportStaff } from "../../services/supportApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useState } from "react"
import ApiPager from "../rental-api/ApiPager"
import SupportReadState from "./SupportReadState"
import { supportInputClass } from "./presentation"

export default function SupportStaffPicker({
  facilityId,
  value,
  onChange,
  disabled,
}: {
  facilityId: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { manager, copy } = useManagerPresentation()

  const [page, setPage] = useState(0)
  const actor = getAuthenticatedActor()
  const read = useRentalApiResource(
    `${actor?.id}:${JSON.stringify(actor?.permissions)}:support-staff:${facilityId}:${page}`,
    () => listSupportStaff(facilityId, page),
  )
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm">
        Nhân viên đủ quyền tại cơ sở
        <select
          aria-label="Nhân viên đủ quyền tại cơ sở"
          className={supportInputClass}
          disabled={disabled || read.loading || !read.data}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Chọn nhân viên</option>
          {value && !read.data?.data.some((s) => s.id === value) && (
            <option value={value}>{value}</option>
          )}
          {read.data?.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} · {s.id}
            </option>
          ))}
        </select>
      </label>
      <SupportReadState {...read} retry={read.refresh} />
      {read.data && (
        <>
          <ApiPager
            pagination={read.data.pagination}
            onPage={setPage}
            disabled={disabled}
          />
          {read.data.data.length === 0 && (
            <p className="text-sm text-amber-800">
              Chưa có nhân viên đủ điều kiện xử lý yêu cầu tại cơ sở này.
            </p>
          )}
        </>
      )}
    </div>
  )
}
