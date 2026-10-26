import { parseVietnamDate, vietnamDateInput } from '../../utils/vietnamTime'
import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { RentalDeadlineBanner, rentalDeadlineState, rentalDaysUntilDeadline } from "./RentalDeadlineNotice"
import { Button, Card, Modal } from "../../components/ui"
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
import RentalDetail from "./RentalDetail"
import RenewalDetail from "./RenewalDetail"
import RenewalOperationsPanel, { RenewalDocumentHistory, RenewalPaymentHistory } from "./RenewalOperationsPanel"
import RenewalDecisionModal from "./RenewalDecisionModal"
import CustomerRenewalRequestModal from "../customer/CustomerRenewalRequestModal"
import ReturnApiPanel from "../return-api/ReturnApiPanel"
import {
  rentalDate,
  rentalMoney,
  rentalLabels,
  rentalPeriodText,
  renewalLabels,
} from "./presentation"

const inputClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
const customerRentalColumns = 'grid grid-cols-[minmax(165px,1.3fr)_minmax(145px,1fr)_minmax(135px,0.9fr)_minmax(135px,0.9fr)_minmax(125px,0.8fr)_minmax(315px,1.4fr)]'
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
const customerRenewalFilterStatuses = new Set([
  "pending",
  "accepted",
  "deposit_paid",
  "full_rent_paid",
  "appointment_scheduled",
])

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

export default function RentalApiWorkspace({ role, focusStorageUnitId, initialRentalId }: { role: RentalApiRole; focusStorageUnitId?: string; initialRentalId?: string }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  return <WorkspaceSession key={`${identity}:${initialRentalId ?? ''}`} role={role} focusStorageUnitId={focusStorageUnitId} initialRentalId={initialRentalId} />
}

function WorkspaceSession({ role, focusStorageUnitId, initialRentalId }: { role: RentalApiRole; focusStorageUnitId?: string; initialRentalId?: string }) {
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
  const [tab, setTab] = useState<"rental" | "renewal">(paymentReturn?"renewal":"rental")
  const [rq, setRq] = useState<RentalApiQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    facilityId,
    sort: "createdAt,desc",
  })
  const [nq, setNq] = useState<RenewalApiQuery>({
    page: 0,
    size: role === "manager" ? 10 : 20,
    facilityId,
    sort: "createdAt,desc",
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
      focusStorageUnitId={focusStorageUnitId}
      key={identity}
      role={role}
      identity={identity}
      tab={tab}
      setTab={(t) => {
        setTab(t)
        setSearch("")
        setRq((q) => ({ ...q, search: undefined, page: 0 }))
        setNq((q) => ({ ...q, search: undefined, page: 0 }))
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
  focusStorageUnitId,
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
  focusStorageUnitId?: string
  role: RentalApiRole
  identity: string
  tab: "rental" | "renewal"
  setTab: (t: "rental" | "renewal") => void
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
  const [returnRental, setReturnRental] = useState<{ id: string; active: boolean }>()
  const [rentalFilterDraft, setRentalFilterDraft] = useState(nq.rentalId || "")
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
        listRenewals(role, { ...scope, size: 1, status: "pending" }),
        listRenewals(role, { ...scope, size: 1, status: "accepted" }),
      ])
      return [
        result[0].pagination.totalItems,
        result[1].pagination.totalItems,
        result[2].pagination.totalItems,
        result[3].pagination.totalItems + result[4].pagination.totalItems,
      ]
    },
  )
  const change = (patch: RentalApiQuery | RenewalApiQuery) => {
    if (tab === "rental") setRq({ ...rq, ...patch, page: 0 } as RentalApiQuery)
    else setNq({ ...nq, ...patch, page: 0 } as RenewalApiQuery)
  }
  const refresh = () => {
    read.refresh()
    counts.refresh()
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
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{role === 'customer' ? 'Kho của bạn' : 'Quản lý hợp đồng'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{role === "manager" ? "Hồ sơ thuê & Gia hạn" : "Hồ sơ thuê"}</h1>
        <p className="mt-1 text-sm text-stone-500">Thông tin hợp đồng, thời hạn thuê, gia hạn và trả kho trong cùng một nơi.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Tổng hồ sơ",
          "Đang hiệu lực",
          "Hết hạn trong 30 ngày",
          "Yêu cầu gia hạn",
        ].map((label, i) => (
          <Card className={`rounded-xl border-t-4 p-4 ${['border-t-stone-700', 'border-t-emerald-500', 'border-t-amber-500', 'border-t-blue-500'][i]}`} key={label}>
            <p className="text-xs font-medium text-stone-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              {counts.loading ? "…" : (counts.data?.[i] ?? copy("Chưa có"))}
            </p>
          </Card>
        ))}
      </div>
      {counts.error ? (
        <ApiReadState {...counts} retry={counts.refresh} />
      ) : null}
      <div className="flex w-fit flex-wrap gap-2 rounded-xl border border-stone-200 bg-white p-1.5">
        <Button
          variant={tab === "rental" ? "primary" : "outline"}
          onClick={() => setTab("rental")}
        >
          Hồ sơ thuê
        </Button>
        <Button
          variant={tab === "renewal" ? "primary" : "outline"}
          onClick={() => setTab("renewal")}
        >
          Yêu cầu gia hạn
        </Button>
      </div>
      <Card className={`grid items-end gap-3 p-4 sm:grid-cols-2 ${role === "manager" ? (tab === "renewal" ? "xl:grid-cols-4" : "xl:grid-cols-3") : "xl:grid-cols-2"}`}>
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
            {Object.entries(tab === "rental" ? rentalLabels : renewalLabels)
              .filter(([value]) => tab !== "renewal" || role === "manager" || customerRenewalFilterStatuses.has(value))
              .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
              ))}
          </select>
        </label>
        {(tab === "rental" || role === "manager") && (
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
            <Button type="submit" className="h-[42px] shrink-0 self-end">
              Tìm kiếm
            </Button>
          </form>
        )}
        {tab === "renewal" && (
          <label className="block min-w-0">
            Mã hồ sơ thuê
            <input
              className={`${inputClass} mt-1 block h-[42px] w-full`}
              value={rentalFilterDraft}
              onChange={(e) => setRentalFilterDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  change({ rentalId: rentalFilterDraft.trim() || undefined })
              }}
              onBlur={() =>
                change({ rentalId: rentalFilterDraft.trim() || undefined })
              }
            />
          </label>
        )}
        {role === "manager" && (
          <label className="block min-w-0">
            Sắp xếp
            <select
              className={`${inputClass} mt-1 block h-[42px] w-full`}
              value={query.sort || "createdAt,desc"}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="createdAt,desc">Mới nhất</option>
              <option value="createdAt,asc">Cũ nhất</option>
              <option value={tab === "rental" ? "contractEndDate,asc" : "newEndDate,asc"}>
                {tab === "rental" ? "Ngày hết hạn gần nhất" : "Ngày kết thúc đề nghị gần nhất"}
              </option>
              <option value={tab === "rental" ? "monthlyPrice,desc" : "amount,desc"}>
                Giá giảm dần
              </option>
            </select>
          </label>
        )}
      </Card>
      <ApiReadState {...read} retry={refresh} />
      {read.data && (
        <Card className={role === 'customer' ? '!border-0 !bg-transparent !shadow-none' : 'overflow-hidden rounded-2xl'}>
          {role !== 'customer' && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3"><h2 className="font-bold text-stone-900">{tab === 'rental' ? 'Danh sách hồ sơ thuê' : 'Danh sách yêu cầu gia hạn'}</h2><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{read.data.page.pagination.totalItems} hồ sơ</span></div>}
          {role === 'customer' && read.data.kind === 'renewal' ? <CustomerRenewalGroups rows={read.data.page.data} onDetail={id => setDetail({ kind: 'renewal', id })} /> : role === 'customer' && read.data.kind === 'rental' ? <div className="space-y-5">{[
            { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Hồ sơ đang thuê, quá hạn hoặc đang xử lý trả kho.', rows: read.data.page.data.filter(row => row.status !== 'completed'), active: true },
            { id: 'finished', title: 'Hồ sơ đã kết thúc', subtitle: 'Hồ sơ thuê đã hoàn tất xử lý.', rows: read.data.page.data.filter(row => row.status === 'completed'), active: false },
          ].map(group => <section key={group.id} aria-labelledby={`rental-group-${group.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
              <div className="flex items-center gap-3"><span aria-hidden="true" className={`h-8 w-1 rounded-full ${group.active ? 'bg-amber-400' : 'bg-stone-300'}`} /><div><h2 id={`rental-group-${group.id}`} className="text-base font-semibold text-stone-900">{group.title}</h2><p className="mt-0.5 text-xs text-stone-500">{group.subtitle}</p></div></div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${group.active ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{group.rows.length} hồ sơ</span>
            </header>
            {group.rows.length ? <div className="overflow-x-auto bg-stone-50/60 p-4">
            <div className="min-w-[1050px] space-y-2">
            <div className={`${customerRentalColumns} border-l-4 border-transparent px-1 text-xs font-semibold text-stone-500`}>
              {['Kho / Cơ sở', 'Mã hồ sơ', 'Trạng thái', 'Thời hạn thuê', 'Giá thuê / tháng', 'Thao tác'].map(label => <div key={label} className="px-3 py-2">{label}</div>)}
            </div>
            {group.rows.map(row => {
              const days = rentalDaysUntilDeadline(row)
              const focused = focusStorageUnitId === row.storageUnit.id && row.status !== 'completed'
              return <article key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1}
                className={`min-w-0 overflow-hidden rounded-xl border border-stone-200 border-l-4 border-l-amber-500 bg-white shadow-sm transition-colors duration-200 hover:border-amber-300 hover:bg-white hover:shadow-md focus-within:border-l-amber-500 ${focused ? 'outline outline-2 outline-amber-400' : ''}`}>
                <div className={`${customerRentalColumns} items-center divide-x divide-stone-100 px-1 py-2`}>
                    <div className="min-w-0 px-3"><p className="text-sm font-bold text-stone-900">{row.storageUnit.code}</p><h3 className="mt-0.5 text-xs font-medium text-stone-700">{row.facility.name}</h3><p className="mt-0.5 text-xs text-stone-500">{copy(row.unitType.name)}</p></div>
                    <div className="min-w-0 px-3"><span className="break-all font-mono text-xs leading-5 text-stone-500" title={row.id}>{row.id}</span></div>
                    <div className="flex flex-wrap gap-1.5 px-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : row.status === 'completed' ? 'bg-stone-100 text-stone-600' : 'bg-amber-100 text-amber-800'}`}>{copy(rentalLabels[row.status])}</span>
                      {row.status === 'active' && row.inventoryPending && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Chưa kiểm kê</span>}
                      {row.status !== 'completed' && Number.isFinite(days) && days <= 7 && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${days <= -8 ? 'bg-red-100 text-red-800' : days < 0 ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'}`}>{days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}</span>}
                    </div>
                  <div className="px-3 text-xs font-medium text-stone-800"><p>{rentalDate(row.startDate)}</p><p className="text-xs font-normal text-stone-400">đến</p><p>{rentalDate(row.dateSemantics?.lastPermittedDate || row.contractEndDate)}</p></div>
                  <div className="px-3 text-xs font-bold text-stone-900">{row.monthlyPrice == null ? 'Chưa xác định' : rentalMoney(row.monthlyPrice, row.currency)}</div>
                  <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap px-3 [&>button]:shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setDetail({ kind: 'rental', id: row.id })}>Chi tiết hồ sơ</Button>
                    <Button size="sm" variant="outline" className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700" disabled={row.status !== 'active'} onClick={() => setAction({ kind: 'request', rentalId: row.id })}>Gia hạn</Button>
                    <Button size="sm" variant="primary" disabled={row.status === 'completed'} onClick={() => setReturnRental({ id: row.id, active: row.status === 'active' || row.status === 'setup' })}>Trả kho</Button>
                  </div>
                </div>
                {rentalDeadlineState(row) && <div className="px-4 pb-4"><RentalDeadlineBanner rental={row} role={role} /></div>}
              </article>
            })}
            </div>
          </div> : <p className="px-4 py-8 text-center text-sm text-stone-500">{group.active ? 'Không có hồ sơ thuê đang diễn ra.' : 'Chưa có hồ sơ thuê đã kết thúc.'}</p>}
          </section>)}</div> : <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ thuê hoặc gia hạn</caption>
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[17%]" />
                <col className="w-[24%]" />
                <col className="w-[23%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Mã hồ sơ",
                    role === 'customer' ? 'Trạng thái' : 'Khách hàng',
                    role === "manager" ? "Gian kho" : "Gian kho / Loại",
                    "Thời hạn",
                    "Thao tác",
                  ].map((h, i) => (
                    <th key={i} className={`p-3 align-middle font-semibold text-stone-600 ${i === 4 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {read.data.page.data.map((row) => (
                  <Fragment key={row.id}>
                  <tr key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1} className={`border-t border-stone-200 odd:bg-white even:bg-stone-50/50 hover:bg-amber-50/40 ${focusStorageUnitId && row.storageUnit.id === focusStorageUnitId && row.status !== 'completed' ? 'outline outline-2 outline-amber-400 bg-amber-50' : ''}`}>
                    <td className="p-3 align-middle">
                      <code
                        className="block break-all rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 font-mono text-xs leading-5 tracking-tight text-stone-700"
                        title={row.id}
                      >
                        {"rentalId" in row ? row.displayCode || row.id : row.id}
                      </code>
                    </td>
                    <td className="p-3 align-middle">
                      {role === 'customer' ? <div className="flex flex-wrap gap-1.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'active' ? 'bg-emerald-50 text-emerald-800' : row.status === 'completed' ? 'bg-stone-100 text-stone-600' : 'bg-amber-100 text-amber-800'}`}>{copy(("contractEndDate" in row ? rentalLabels : renewalLabels)[row.status] || row.status)}</span>{"contractEndDate" in row && row.status === 'active' && row.inventoryPending && <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Chưa kiểm kê</span>}</div> : <div><p className="font-semibold text-stone-900">{row.customer.fullName}</p>{"contractEndDate" in row && row.status === 'active' && row.inventoryPending && <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Chưa kiểm kê</span>}</div>}
                    </td>
                    <td className="p-3 align-middle">
                      <p className="font-mono text-sm font-semibold text-stone-800">{row.storageUnit.code}</p>
                      {role !== "manager" && 'facility' in row && <p className="mt-1 break-words text-xs text-stone-600">{row.facility.name}</p>}
                      {role !== "manager" && "unitType" in row && (
                        <p className="mt-1 text-xs leading-4 text-stone-500">{copy(row.unitType.name)}</p>
                      )}
                    </td>
                    <td className="p-3 align-middle">
                      <p className="text-sm leading-6">{"contractEndDate" in row
                        ? rentalPeriodText(row, false)
                        : rentalDate(row.newEndDate)}</p>
                      {role === 'manager' && <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
                        {copy(("contractEndDate" in row ? rentalLabels : renewalLabels)[row.status] || row.status)}
                      </span>}
                    </td>
                    <td className="p-3 align-middle text-center">
                      <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-24 justify-center whitespace-nowrap"
                        onClick={() =>
                          setDetail({ kind: read.data!.kind, id: row.id })
                        }
                      >
                        Chi tiết
                      </Button>
                      {role === 'customer' && 'contractEndDate' in row && <>
                        <Button size="sm" variant="outline" className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700" disabled={row.status !== 'active'} onClick={() => setAction({ kind: 'request', rentalId: row.id })}>Gia hạn</Button>
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
      {returnRental && <Modal open onClose={() => setReturnRental(undefined)} title="Trả kho & quyết toán" size="xl">
        <ReturnApiPanel role="customer" rentalId={returnRental.id} rentalActive={returnRental.active} onChanged={refresh} />
      </Modal>}
      {action?.kind === "request" && (
        <CustomerRenewalRequestModal
          key={`${identity}:${action.rentalId}:${action.revision?.id}`}
          actorId={actor.id}
          rentalId={action.rentalId}
          revision={action.revision}
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
          onNavigateToRenewals={() => {
            setAction(undefined)
            setDetail(undefined)
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
            appointmentSelection={undefined}
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
