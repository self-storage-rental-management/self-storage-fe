import { parseVietnamDate, vietnamDateInput } from '../../utils/vietnamTime'
import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { RentalDeadlineBanner, rentalDeadlineState, getRentalRenewalEligibility } from "./RentalDeadlineNotice"
import { Badge, Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { downloadCheckInEvidence } from "../../services/checkInApi"
import { getRental, listRentals } from "../../services/rentalApi"
import { listRentalHandoverFiles } from "../../services/rentalHandoverFilesApi"
import { getRenewal, listRenewals } from "../../services/renewalApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type {
  RentalApiDetail,
  RentalApiQuery,
  RentalApiRole,
} from "../../types/rentalApi"
import type { RenewalApiQuery, RenewalApiRecord } from "../../types/renewalApi"
import type { RenewalOperationEvent } from "../../types/renewalOperationsApi"
import ApiReadState from "./ApiReadState"
import CustomerRenewalGroups from './CustomerRenewalGroups'
import { renewalPrimaryClass, RenewalSearch } from './renewalListStyles'
import ManagerRentalGroups from './ManagerRentalGroups'
import { RentalRecordGroup, RentalRecordRow } from './RentalRecordList'
import RentalDetail from "./RentalDetail"
import RenewalDetail from "./RenewalDetail"
import RenewalOperationsPanel, { RenewalDocumentHistory, RenewalPaymentHistory } from "./RenewalOperationsPanel"
import RenewalDecisionModal from "./RenewalDecisionModal"
import CustomerRenewalRequestModal from "../customer/CustomerRenewalRequestModal"
import ReturnApiPanel from "../return-api/ReturnApiPanel"
import { ViolationRecoveryPanel } from "../return-api/ViolationRecoveryPanel"
import {
  rentalDate,
  rentalMoney,
  rentalLabels,
  rentalRecordLabel,
  rentalStatusLabel,
  rentalPeriodText,
  renewalLabels,
} from "./presentation"

const inputClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
function recordStatusTone(status: string) {
  if (status === 'payment_failed') return 'error'
  if (['active', 'deposit_paid', 'full_rent_paid'].includes(status)) return 'success'
  if (['return_requested', 'return_inspection', 'closing', 'pending', 'accepted', 'approved', 'appointment_scheduled', 'payment_processing', 'payment_expired'].includes(status)) return 'warning'
  return 'muted'
}
type Detail = {
  kind: "rental" | "renewal"
  id: string
}
type Action = {
  kind: "request"
  rentalId: string
  revision?: RenewalApiRecord
} | {
  kind: "cancel"
  renewal: RenewalApiRecord
}
function Pager({
  page,
  pages,
  total,
  size,
  setPage,
  setSize,
  fixedSize = false,
}: {
  page: number
  pages: number
  total: number
  size: number
  setPage: (p: number) => void
  setSize: (s: number) => void
  fixedSize?: boolean
}) {
  const { manager, copy } = useManagerPresentation()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <span>
        {total} hồ sơ, Trang {pages ? page + 1 : 0}/{pages}
      </span>
      <div className="flex gap-2">
        {!fixedSize && <select
          aria-label="Số hồ sơ mỗi trang"
          className={inputClass}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>}
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Trước
        </Button>
        <Button
          variant="outline"
          disabled={page + 1 >= pages}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  )
}

type WorkspaceTab = "rental" | "renewal" | "recovery"

const workspaceTabs: ReadonlyArray<readonly [WorkspaceTab, string]> = [
  ["rental", "Hồ sơ thuê"],
  ["renewal", "Yêu cầu gia hạn"],
  ["recovery", "Thu hồi kho"],
]

type WorkspaceProps = {
  recoveryTarget?: { id: string; request: number }
  role: RentalApiRole
  focusStorageUnitId?: string
  initialRentalId?: string
  onRequestSupport?: (id: string, unitCode: string) => void
  onBrowseUnits?: () => void
}

export default function RentalApiWorkspace(props: WorkspaceProps) {
  const { role, initialRentalId } = props
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  return <WorkspaceSession key={`${identity}:${initialRentalId ?? ''}`} {...props} />
}

function WorkspaceSession({ recoveryTarget, role, focusStorageUnitId, initialRentalId, onRequestSupport, onBrowseUnits }: WorkspaceProps) {
  const actor = getAuthenticatedActor()
  const facilityId = role === "manager" ? singleManagerFacility(actor) : undefined
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  const [paymentReturn] = useState(() => {
    if(typeof window==="undefined")return null
    const params=new URLSearchParams(window.location.search)
    const renewalId=params.get("renewalId")
    return role==="customer"&&params.get("vnpayReturn")==="true"&&renewalId
      ? {renewalId,status:params.get("status")} : null
  })
  const [tab, setTab] = useState<WorkspaceTab>(recoveryTarget ? "recovery" : paymentReturn ? "renewal" : "rental")
  const [focusedRecovery, setFocusedRecovery] = useState(recoveryTarget)
  const [rq, setRq] = useState<RentalApiQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    facilityId,
    sort: "priority,asc",
  })
  const [nq, setNq] = useState<RenewalApiQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    facilityId,
    sort: "priority,asc",
  })
  const [search, setSearch] = useState("")
  const [detail, setDetail] = useState<Detail|undefined>(paymentReturn?{kind:"renewal",id:paymentReturn.renewalId}:initialRentalId?{kind:"rental",id:initialRentalId}:undefined)
  const [action, setAction] = useState<Action>()
  const permitted =
    actor?.status === "ACTIVE" &&
    actor.roles.includes(role === "manager" ? "MANAGER" : "CUSTOMER") &&
    (role !== "manager" || actor.permissions.includes("rentals:read"))
  useEffect(()=>{
    if(!paymentReturn||typeof window==="undefined")return
    const url=new URL(window.location.href)
    for(const key of ["renewalId","vnpayReturn","status","code"])url.searchParams.delete(key)
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`)
  },[paymentReturn])
  // Parent mounts this workspace keyed by actor/scope. Backend remains authority.
  if (!permitted)
    return (
      <Card className="p-5">Bạn chưa có quyền đọc hồ sơ thuê/gia hạn.</Card>
    )
  if (role === "manager" && !facilityId)
    return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return (
    <WorkspaceData
      recoveryTarget={focusedRecovery}
      focusStorageUnitId={focusStorageUnitId}
      onRequestSupport={onRequestSupport}
      onBrowseUnits={onBrowseUnits}
      key={identity}
      role={role}
      identity={identity}
      tab={tab}
      setTab={(t) => {
        if (t !== "recovery") setFocusedRecovery(undefined)
        setTab(t)
        setSearch("")
        setRq((q) => ({ ...q, search: undefined, page: 0 }))
        setNq((q) => ({ ...q, search: undefined, status: undefined, rentalId: undefined, page: 0 }))
        setDetail(undefined)
        setAction(undefined)
      }}
      rq={rq}
      nq={nq}
      setRq={setRq}
      setNq={setNq}
      search={search}
      setSearch={setSearch}
      detail={detail}
      setDetail={setDetail}
      action={action}
      setAction={setAction}
    />
  )
}

function WorkspaceData({
  recoveryTarget,
  focusStorageUnitId,
  onRequestSupport,
  onBrowseUnits,
  role,
  identity,
  tab,
  setTab,
  rq,
  nq,
  setRq,
  setNq,
  search,
  setSearch,
  detail,
  setDetail,
  action,
  setAction,
}: {
  recoveryTarget?: WorkspaceProps["recoveryTarget"]
  focusStorageUnitId?: string
  onRequestSupport?: WorkspaceProps['onRequestSupport']
  onBrowseUnits?: WorkspaceProps['onBrowseUnits']
  role: RentalApiRole
  identity: string
  tab: WorkspaceTab
  setTab: (t: WorkspaceTab) => void
  rq: RentalApiQuery
  nq: RenewalApiQuery
  setRq: (q: RentalApiQuery) => void
  setNq: (q: RenewalApiQuery) => void
  search: string
  setSearch: (s: string) => void
  detail?: Detail
  setDetail: (d?: Detail) => void
  action?: Action
  setAction: (a?: Action) => void
}) {
  const { manager, copy } = useManagerPresentation()

  const actor = getAuthenticatedActor()!
  const [rentalPages, setRentalPages] = useState<Record<string, number>>({})
  useEffect(() => setRentalPages({}), [rq.search, rq.status, rq.sort])
  const [returnRental, setReturnRental] = useState<{ id: string; active: boolean }>()
  const dataTab = tab === "renewal" ? "renewal" : "rental"
  const query = dataTab === "rental" ? rq : nq
  const read = useRentalApiResource(
    `${identity}:${dataTab}:${JSON.stringify(query)}`,
    async () =>
      dataTab === "rental"
        ? { kind: "rental" as const, page: await (async () => {
          if (role !== 'customer') return listRentals(role, rq)
          const first = await listRentals(role, { ...rq, page: 0, size: 100 })
          const rows = [...first.data]
          for (let page = 1; page < first.pagination.totalPages; page++) {
            const next = await listRentals(role, { ...rq, page, size: 100 })
            rows.push(...next.data)
          }
          const data = [...new Map(rows.map(row => [row.id, row])).values()]
          return { ...first, data, pagination: { ...first.pagination, page: 0, totalPages: 1, totalItems: data.length } }
        })() }
        : { kind: "renewal" as const, page: await (async () => {
          if (role === 'staff') {
            return { data: [], pagination: { page: 0, pageSize: nq.size ?? 20, totalItems: 0, totalPages: 0, sort: '' } }
          }
          if (role !== 'customer') return listRenewals(role, nq)
          const first = await listRenewals(role, { ...nq, page: 0, size: 100 })
          const rows = [...first.data]
          for (let page = 1; page < first.pagination.totalPages; page++) {
            const next = await listRenewals(role, { ...nq, page, size: 100 })
            rows.push(...next.data)
          }
          return { ...first, data: [...new Map(rows.map(row => [row.id, row])).values()] }
        })() },
  )
  useEffect(() => {
    if (!focusStorageUnitId || role !== 'customer' || tab !== 'rental' || read.loading || read.data?.kind !== 'rental') return
    const row = read.data.page.data.find(item => item.storageUnit.id === focusStorageUnitId && item.status !== 'completed')
    if (!row) {
      const pagination = read.data.page.pagination
      if (pagination.page + 1 < pagination.totalPages) setRq({ ...rq, page: pagination.page + 1 })
      return
    }
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`rental-api-record-${row.id}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [focusStorageUnitId, role, tab, read.loading, read.data])
  const counts = useRentalApiResource(
    `${identity}:${query.facilityId}:counts`,
    async () => {
      const now = new Date()
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now)
      const end = parseVietnamDate(`${date}T00:00:00Z`)
      end.setUTCDate(end.getUTCDate() + 30)
      const scope = role === "manager" ? { facilityId: query.facilityId } : {}
      const emptyRenewals = { data: [], pagination: { page: 0, pageSize: 1, totalItems: 0, totalPages: 0, sort: '' } }
      const result = await Promise.all([
        listRentals(role, { ...scope, size: 1 }),
        listRentals(role, { ...scope, size: 1, status: "active" }),
        listRentals(role, {
          ...scope,
          size: 1,
          status: "active",
          endFrom: date,
          endTo: vietnamDateInput(end),
        }),
        role === "staff"
          ? Promise.resolve(emptyRenewals)
          : listRenewals(role, { ...scope, size: 1, status: "pending" }),
        role === "staff"
          ? Promise.resolve(emptyRenewals)
          : listRenewals(role, { ...scope, size: 1, status: "accepted" }),
      ])
      return [
        result[0].pagination.totalItems,
        result[1].pagination.totalItems,
        result[2].pagination.totalItems,
        result[3].pagination.totalItems + result[4].pagination.totalItems,
      ]
    },
  )
  const customerRenewals = useRentalApiResource(
    `${identity}:customer-open-renewals`,
    async () => {
      if (role !== "customer") return []
      const res = await listRenewals("customer", { size: 100 })
      return res.data
    },
  )
  const change = (patch: RentalApiQuery | RenewalApiQuery) => {
    if (tab === "rental") setRq({ ...rq, ...patch, page: 0 } as RentalApiQuery)
    else setNq({ ...nq, ...patch, page: 0 } as RenewalApiQuery)
  }
  const refresh = () => {
    read.refresh()
    counts.refresh()
    customerRenewals.refresh()
  }
  const success = () => {
    setAction(undefined)
    setDetail(undefined)
    refresh()
  }
  useEffect(() => {
    const p = read.data?.page.pagination
    if (p && p.page > 0 && p.page >= p.totalPages) {
      if (dataTab === "rental")
        setRq({ ...rq, page: Math.max(0, p.totalPages - 1) })
      else setNq({ ...nq, page: Math.max(0, p.totalPages - 1) })
    }
  }, [read.data, dataTab, rq, nq, setRq, setNq])
  return (
    <div className="space-y-5">
      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{role === 'customer' ? 'Kho của bạn' : 'Quản lý hợp đồng'}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{role === "manager" ? "Hồ sơ thuê & Gia hạn" : "Hồ sơ thuê"}</h1>
            <p className="mt-1 text-sm text-stone-500">Thông tin hợp đồng, thời hạn thuê, gia hạn và trả kho trong cùng một nơi.</p>
          </div>
        </div>
      <div className={role === "customer" ? "grid grid-cols-2 gap-2 lg:grid-cols-4" : "grid gap-3 sm:grid-cols-2"}>
        {[
          "Tổng hồ sơ",
          "Đang hiệu lực",
          "Hết hạn trong 30 ngày",
          "Yêu cầu gia hạn",
        ].map((label, i) => (
          <Card className={`${role === "customer" ? "rounded-lg border-t-2 px-3 py-2.5" : "rounded-xl border-t-4 p-4"} ${['border-t-stone-700', 'border-t-emerald-500', 'border-t-amber-500', 'border-t-blue-500'][i]}`} key={label}>
            <p className="text-xs font-medium text-stone-500">{label}</p>
            <p className={role === "customer" ? "mt-1 text-xl font-bold tracking-tight text-stone-900" : "mt-2 text-2xl font-bold tracking-tight text-stone-900"}>
              {counts.loading ? "…" : (counts.data?.[i] ?? copy("Chưa có"))}
            </p>
          </Card>
        ))}
      </div>
      {tab !== "recovery" && counts.error ? (
        <ApiReadState {...counts} retry={counts.refresh} />
      ) : null}
      <div role="group" aria-label="Mục hồ sơ thuê" className={`grid gap-2 rounded-2xl border border-stone-200 bg-white p-1.5 ${role === "customer" ? "grid-cols-3" : "grid-cols-2"}`}>
        {workspaceTabs.filter(([value]) => value !== "recovery" || role === "customer").map(([value, label]) => (
          <Button key={value} type="button" aria-pressed={tab === value} variant={tab === value ? "primary" : "ghost"}
            className={`min-h-11 whitespace-normal rounded-xl px-2 ${tab === value ? renewalPrimaryClass : "!text-stone-600 hover:!bg-stone-50"}`}
            onClick={() => setTab(value)}>
            {label}
          </Button>
        ))}
      </div>
      {tab === "renewal" && role === "manager" && <RenewalSearch value={search} onChange={setSearch} onSearch={() => change({ search: search.trim() || undefined })}>
        <select aria-label="Sắp xếp yêu cầu gia hạn" className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 sm:w-auto"
          value={query.sort || "priority,asc"} onChange={e => change({ sort: e.target.value })}>
          <option value="priority,asc">Cần xử lý / hạn gần nhất</option>
          <option value="createdAt,desc">Mới nhất</option>
          <option value="createdAt,asc">Cũ nhất</option>
          <option value="newEndDate,asc">Ngày kết thúc đề nghị gần nhất</option>
          <option value="amount,desc">Giá giảm dần</option>
        </select>
      </RenewalSearch>}
      {tab === "rental" && <div className={`grid items-end gap-3 ${role === "manager" ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"}`}>
          <form
            className="grid h-full grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              change({ search: search.trim() || undefined })
            }}
          >
            <label className="block min-w-0">
              Tìm kiếm
              <input
                className={`${inputClass} mt-1 block h-[42px] w-full`}
                value={search}
                maxLength={200}
                placeholder="Mã hồ sơ / gian kho"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button type="submit" className="h-[42px] shrink-0 self-end">Tìm kiếm</Button>
          </form>
        <label className="block min-w-0">
          Trạng thái
          <select
            className={`${inputClass} mt-1 block h-[42px] w-full`}
            value={query.status || ""}
            onChange={(e) =>
              change({ status: e.target.value || undefined } as RentalApiQuery)
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(rentalLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
              ))}
          </select>
        </label>
        {role === "manager" && (
          <label className="block min-w-0">
            Sắp xếp
            <select
              className={`${inputClass} mt-1 block h-[42px] w-full`}
              value={query.sort || "priority,asc"}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="priority,asc">Cần xử lý / hạn gần nhất</option>
              <option value="createdAt,desc">Mới nhất</option>
              <option value="createdAt,asc">Cũ nhất</option>
              <option value="contractEndDate,asc">Ngày hết hạn gần nhất</option>
              <option value="monthlyPrice,desc">Giá giảm dần</option>
            </select>
          </label>
        )}
      </div>}
      </section>
      {tab === "recovery" ? <ViolationRecoveryPanel target={recoveryTarget} /> : <ApiReadState {...read} retry={refresh} />}
      {tab !== "recovery" && read.data && (
        <Card className={role === 'customer' || (role === 'manager' && read.data.kind === 'rental') ? '!border-0 !bg-transparent !shadow-none' : 'overflow-hidden rounded-2xl'}>
          {role === 'manager' ? (read.data.kind === 'rental'
            ? <ManagerRentalGroups kind="rental" rows={read.data.page.data} onDetail={id => setDetail({ kind: 'rental', id })} />
            : <ManagerRentalGroups kind="renewal" rows={read.data.page.data} onDetail={id => setDetail({ kind: 'renewal', id })} />
          ) : role === 'customer' && read.data.kind === 'renewal' ? <CustomerRenewalGroups rows={read.data.page.data} onDetail={id => setDetail({ kind: 'renewal', id })} /> : role === 'customer' && read.data.kind === 'rental' ? <div className="space-y-5">{(() => {
            const returningStatuses = ['return_requested', 'return_inspection', 'closing']
            const returningRows = read.data.page.data.filter(row => returningStatuses.includes(row.status))
            return [
              { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Hồ sơ đang thuê, trong thời gian chuẩn bị hoặc quá hạn.', rows: read.data.page.data.filter(row => row.status !== 'completed' && !returningStatuses.includes(row.status)), active: true },
              ...(returningRows.length > 0 ? [{ id: 'returning', title: 'Đang trả kho', subtitle: 'Hồ sơ đã chuyển sang quy trình trả kho, nghiệm thu và quyết toán.', rows: returningRows, active: true }] : []),
              { id: 'finished', title: 'Hồ sơ đã kết thúc', subtitle: 'Hồ sơ thuê đã hoàn tất xử lý.', rows: read.data.page.data.filter(row => row.status === 'completed'), active: false },
            ]
          })().sort((a, b) => Number(b.active) - Number(a.active)
            || (a.rows.length ? read.data!.page.data.findIndex(row => row.id === a.rows[0].id) : Infinity) - (b.rows.length ? read.data!.page.data.findIndex(row => row.id === b.rows[0].id) : Infinity))
          .map(group => {
            const pages = Math.ceil(group.rows.length / 5)
            const page = Math.min(rentalPages[group.id] ?? 0, Math.max(0, pages - 1))
            return <RentalRecordGroup key={group.id} id={`rental-group-${group.id}`} title={group.title} subtitle={group.subtitle}
              count={group.rows.length} active={group.active}
              empty={group.active ? 'Không có hồ sơ thuê đang diễn ra.' : 'Chưa có hồ sơ thuê đã kết thúc.'}
              footer={<Pager fixedSize page={page} pages={pages} total={group.rows.length} size={5}
                setSize={() => {}}
                setPage={next => setRentalPages(current => ({ ...current, [group.id]: next }))} />}>
              {group.rows.slice(page * 5, (page + 1) * 5).map(row => <RentalRecordRow
                key={row.id}
                rental={row}
                role="customer"
                unitTypeName={copy(row.unitType.name)}
                focused={focusStorageUnitId === row.storageUnit.id && row.status !== 'completed'}
                actions={<>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDetail({ kind: 'rental', id: row.id })}>
                    {row.canConfirmRentalStart ? 'Xem & xác nhận' : 'Chi tiết hồ sơ'}
                  </Button>
                  {(() => {
                      const eligibility = getRentalRenewalEligibility(row, customerRenewals.data || [])
                      return eligibility.hasOpenRenewal ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="!border-amber-400 !bg-amber-50 !text-amber-800 hover:!bg-amber-100"
                          title="Hợp đồng này đã có yêu cầu gia hạn đang được xử lý. Bấm để xem chi tiết."
                          onClick={() => {
                            setTab('renewal')
                            setDetail({ kind: 'renewal', id: eligibility.openRenewal!.id })
                          }}
                        >
                          Đang xử lý gia hạn
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:opacity-50"
                          disabled={!eligibility.canRenew}
                          title={eligibility.reason}
                          onClick={() => setAction({ kind: 'request', rentalId: row.id })}
                        >
                          Gia hạn
                        </Button>
                      )
                    })()}
                  <Button type="button" size="sm" variant="outline" className="!border-amber-400 !bg-amber-100 !text-amber-950 hover:!bg-amber-200"
                    disabled={row.status === 'completed'} onClick={() => setReturnRental({ id: row.id, active: row.status === 'active' || row.status === 'setup' })}>Trả kho</Button>
                  {onRequestSupport && <Button type="button" size="sm" variant="outline" onClick={() => onRequestSupport(row.id, row.storageUnit.code)}>Hỗ trợ hồ sơ</Button>}
                </>}
              />)}
            </RentalRecordGroup>
          })}</div> : <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ thuê hoặc gia hạn</caption>
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[18%]" />
                <col className="w-[29%]" />
                <col />
                <col className="w-28" />
              </colgroup>
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Mã hồ sơ",
                    role === 'customer' ? 'Trạng thái' : 'Khách hàng',
                    "Gian kho / Loại",
                    "Thời hạn",
                    "Thao tác",
                  ].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 align-middle text-xs font-semibold text-stone-600 ${i === 4 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {read.data.page.data.map((row) => (
                  <Fragment key={row.id}>
                  <tr key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1} className={`border-t border-stone-200 odd:bg-white even:bg-stone-50/50 hover:bg-amber-50/40 ${focusStorageUnitId && row.storageUnit.id === focusStorageUnitId && row.status !== 'completed' ? 'outline outline-2 outline-amber-400 bg-amber-50' : ''}`}>
                    <td className="px-4 py-2.5 align-middle">
                      <code
                        className="block max-w-[24ch] truncate font-mono text-xs leading-5 text-stone-600"
                        title={rentalRecordLabel(row)}
                      >
                        {rentalRecordLabel(row)}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      {role === 'customer' ? <Badge variant={recordStatusTone(row.status)}>{copy("contractEndDate" in row ? rentalStatusLabel(row) : renewalLabels[row.status] || row.status)}</Badge> : <p className="truncate font-medium text-stone-900" title={row.customer.fullName}>{row.customer.fullName}</p>}
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <p className="truncate font-mono text-xs font-medium leading-5 text-stone-800" title={row.storageUnit.code}>{row.storageUnit.code}</p>
                      {'facility' in row && <p className="mt-1 break-words text-xs text-stone-600">{row.facility.name}</p>}
                      {"unitType" in row && (
                        <p className="mt-1 text-xs leading-4 text-stone-500">{copy(row.unitType.name)}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <p className="whitespace-nowrap text-xs leading-5 tabular-nums">{"contractEndDate" in row
                        ? rentalPeriodText(row, false)
                        : rentalDate(row.newEndDate)}</p>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-center">
                      <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-8 w-20 justify-center whitespace-nowrap"
                        onClick={() =>
                          setDetail({ kind: read.data!.kind, id: row.id })
                        }
                      >
                        Chi tiết
                      </Button>
                      {role === 'customer' && 'contractEndDate' in row && <>
                        {(() => {
                          const eligibility = getRentalRenewalEligibility(row, customerRenewals.data || [])
                          return eligibility.hasOpenRenewal ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="!border-amber-400 !bg-amber-50 !text-amber-800 hover:!bg-amber-100"
                              title="Hợp đồng này đã có yêu cầu gia hạn đang được xử lý. Bấm để xem chi tiết."
                              onClick={() => {
                                setTab('renewal')
                                setDetail({ kind: 'renewal', id: eligibility.openRenewal!.id })
                              }}
                            >
                              Đang xử lý gia hạn
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:opacity-50"
                              disabled={!eligibility.canRenew}
                              title={eligibility.reason}
                              onClick={() => setAction({ kind: 'request', rentalId: row.id })}
                            >
                              Gia hạn
                            </Button>
                          )
                        })()}
                        <Button size="sm" variant="primary" disabled={!['setup', 'active', 'return_requested', 'return_inspection', 'closing'].includes(row.status)}
                          onClick={() => setReturnRental({ id: row.id, active: row.status === 'active' || row.status === 'setup' })}>Trả kho</Button>
                      </>}
                      </div>
                    </td>
                  </tr>
                  {role === 'customer' && 'contractEndDate' in row && rentalDeadlineState(row) && <tr>
                    <td colSpan={5} className="border-t border-stone-100 px-3 pb-4">
                      <RentalDeadlineBanner rental={row} role={role} />
                    </td>
                  </tr>}
                  </Fragment>
                ))}
                {read.data.page.data.length === 0 && (
                  <tr>
                    <td colSpan={read.data.kind === "rental" ? 6 : 6} className="p-6 text-center">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>}
          {role !== 'customer' && <Pager
            fixedSize
            {...{
              page: read.data.page.pagination.page,
              pages: read.data.page.pagination.totalPages,
              total: read.data.page.pagination.totalItems,
              size: read.data.page.pagination.pageSize,
            }}
            setSize={(size) => change({ size })}
            setPage={(page) =>
              tab === "rental" ? setRq({ ...rq, page }) : setNq({ ...nq, page })
            }
          />}
        </Card>
      )}
      {detail && (
        <DetailModal
          key={`${identity}:${query.facilityId}:${detail.kind}:${detail.id}`}
          role={role}
          identity={identity}
          detail={detail}
          onClose={() => setDetail(undefined)}
          onAction={setAction}
          onChanged={refresh}
        />
      )}
      {returnRental && <Modal open onClose={() => setReturnRental(undefined)} title="Trả kho" size="2xl">
        <ReturnApiPanel role="customer" rentalId={returnRental.id} rentalActive={returnRental.active} onChanged={refresh} />
      </Modal>}
      {action?.kind === "request" && (
        <CustomerRenewalRequestModal
          key={`${identity}:${action.rentalId}:${action.revision?.id}`}
          actorId={actor.id}
          rentalId={action.rentalId}
          revision={action.revision}
          onBrowseUnits={onBrowseUnits}
          onClose={() => setAction(undefined)}
          onSuccess={(created) => {
            setAction(undefined)
            if (created && typeof created === "object" && "id" in created) {
              setTab("renewal")
              setDetail({ kind: "renewal", id: (created as RenewalApiRecord).id })
            } else {
              setDetail(undefined)
            }
            refresh()
          }}
          onNavigateToRenewals={(renewalId?: string) => {
            setAction(undefined)
            if (renewalId) {
              setDetail({ kind: "renewal", id: renewalId })
            } else {
              setDetail(undefined)
            }
            setTab("renewal")
          }}
        />
      )}
      {action?.kind === "cancel" && (
        <RenewalDecisionModal
          key={`${identity}:${action.renewal.id}:CANCEL`}
          renewal={action.renewal}
          action="CANCEL"
          onClose={() => setAction(undefined)}
          onSuccess={success}
          onRefresh={() => {
            setDetail(undefined)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function DetailModal({
  role,
  identity,
  detail,
  onClose,
  onAction,
  onChanged,
}: {
  role: RentalApiRole
  identity: string
  detail: Detail
  onClose: () => void
  onAction: (a: Action) => void
  onChanged: () => void
}) {
  const { manager, copy } = useManagerPresentation()

  const operationLock = useRef(false)
  const [operationsLocked, setOperationsLocked] = useState(false)
  const [documentEvents, setDocumentEvents] = useState<RenewalOperationEvent[]>([])
  const setOperationLocked = useCallback((value: boolean) => {
    operationLock.current = value
    setOperationsLocked(value)
  }, [])
  const [operationOwner, setOperationOwner] = useState<{
    facilityId: string
    customerId: string
  }>()
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  const read = useRentalApiResource(
    `${identity}:${detail.kind}:${detail.id}`,
    async () =>
      detail.kind === "rental"
        ? { kind: "rental" as const, record: await getRental(role, detail.id) }
        : {
            kind: "renewal" as const,
            record: await getRenewal(role, detail.id),
          },
    { retainDataOnRefresh: true },
  )
  useEffect(() => {
    if (read.data?.kind === "renewal") {
      const r = read.data.record as RenewalApiRecord
      setOperationOwner({
        facilityId: r.facility.id,
        customerId: r.customer.id,
      })
    }
  }, [read.data])
  return (
    <Modal
      open
      size="xl"
      className="overscroll-contain"
      title={
        detail.kind === "rental"
          ? "Chi tiết hồ sơ thuê"
          : "Chi tiết yêu cầu gia hạn"
      }
      onClose={() => {
        if (!operationLock.current) onClose()
      }}
    >
      <ApiReadState {...read} retry={() => {
        if (!operationLock.current) read.refresh()
      }} />
      {read.data?.kind === "rental" ? (
        <div className="space-y-4">
          <RentalDetail
            rental={read.data.record as RentalApiDetail}
            role={role}
            showTechnicalWarnings={role === "manager"}
            onRentalStartConfirmed={() => { read.refresh(); onChanged() }}
          />
        </div>
      ) : read.data?.kind === "renewal" ? (
        <div>
          <RenewalDetail
            renewal={read.data.record as RenewalApiRecord}
            role={role}
            onPaymentChange={read.refresh}
            financeHistory={<RenewalPaymentHistory id={detail.id} role={role} identity={`${detail.id}:${read.data.record.version ?? "unknown"}:finance`} />}
            evidenceDocuments={<RenewalDocumentHistory id={detail.id} role={role} identity={`${detail.id}:${read.data.record.version ?? "unknown"}:documents`} extraEvents={documentEvents} />}
            operationsLocked={operationsLocked}
            appointmentSelection={role === "customer" && read.data.record.status === "accepted" && operationOwner ? (
              <RenewalOperationsPanel
                id={detail.id}
                role="customer"
                status={read.data.record.status}
                {...operationOwner}
                appointmentOnly
                onLocked={setOperationLocked}
                onChanged={() => {
                  read.refresh()
                  onChanged()
                }}
              />
            ) : undefined}
            onAction={(action) => {
              if (operationLock.current) return
              const renewal = read.data!.record as RenewalApiRecord
              onClose()
              if (action === "ACCEPT_REVISED_QUOTE")
                onAction({
                  kind: "request",
                  rentalId: renewal.rentalId,
                  revision: renewal,
                })
              else if (action === "CANCEL") onAction({ kind: "cancel", renewal })
            }}
          />
        </div>
      ) : null}
      {detail.kind === "renewal" && operationOwner && read.data?.kind === "renewal" && !["pending", "accepted"].includes(read.data.record.status) && (
        <RenewalOperationsPanel
          embedded
          status={(read.data.record as RenewalApiRecord).status}
          id={detail.id}
          role={role}
          {...operationOwner}
          onLocked={setOperationLocked}
          onDocumentEvent={event => setDocumentEvents(previous => [event, ...previous.filter(item => item.id !== event.id)])}
          onChanged={() => {
            read.refresh()
            onChanged()
          }}
        />
      )}
    </Modal>
  )
}
