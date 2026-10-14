import { useManagerPresentation } from "../manager/managerPresentation"
import { singleManagerFacility, managerFacilityNotice } from "../manager/managerFacilityUi"
import { useCallback, useEffect, useRef, useState } from "react"
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
import ApiReadState from "./ApiReadState"
import RentalDetail from "./RentalDetail"
import RenewalDetail from "./RenewalDetail"
import RenewalOperationsPanel from "./RenewalOperationsPanel"
import RenewalDecisionModal from "./RenewalDecisionModal"
import CustomerRenewalRequestModal from "../customer/CustomerRenewalRequestModal"
import ReturnApiPanel from "../return-api/ReturnApiPanel"
import {
  rentalDate,
  rentalLabels,
  rentalPeriodText,
  renewalLabels,
} from "./presentation"

const inputClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
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

function RentalContractCell({ role, rentalId }: { role: RentalApiRole; rentalId: string }) {
  const [preview, setPreview] = useState<{ url: string; name: string }>()
  const [previewError, setPreviewError] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewLock = useRef(false)
  const files = useRentalApiResource(
    `${role}:rental-contract:${rentalId}`,
    () => listRentalHandoverFiles(role, rentalId),
  )

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
  }, [preview])

  const openPreview = async (fileId: string, name: string) => {
    if (previewLock.current) return
    previewLock.current = true
    setPreviewLoading(true)
    setPreviewError("")
    try {
      const downloaded = await downloadCheckInEvidence(fileId)
      const type = downloaded.blob.type.toLowerCase().split(";")[0]
      if (type !== "application/pdf") {
        throw new Error("Chỉ hỗ trợ xem trước hợp đồng PDF.")
      }
      const url = URL.createObjectURL(downloaded.blob)
      setPreview({ url, name })
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Không thể tải hợp đồng.")
    } finally {
      previewLock.current = false
      setPreviewLoading(false)
    }
  }

  if (files.loading) return <span className="text-xs text-stone-400">Đang tải…</span>
  if (files.error) {
    return <span className="text-xs text-amber-700" title="Không tải được hợp đồng">Chưa tải được</span>
  }

  const contracts = files.data?.filter((file) =>
    file.kind === "SIGNED_CONTRACT" && file.contentType.toLowerCase().split(";")[0] === "application/pdf",
  ) ?? []
  return contracts.length ? (
    <div className="min-w-0 space-y-2">
      {contracts.map((file) => (
        <div key={file.id} className="min-w-0">
          <span className="block truncate text-sm font-medium text-stone-800" title={file.name}>
            {file.name.replace(/^hop-dong-da-ky-/i, "")}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 whitespace-nowrap"
            disabled={previewLoading}
            onClick={() => void openPreview(file.id, file.name)}
          >
            {previewLoading ? "Đang tải…" : "Xem trước"}
          </Button>
        </div>
      ))}
      {previewError && <p role="alert" className="mt-1 text-xs text-red-700">{previewError}</p>}
      <Modal open={Boolean(preview)} onClose={() => setPreview(undefined)} title={preview?.name} size="3xl">
        {preview && <iframe src={preview.url} title={`Hợp đồng: ${preview.name}`} className="h-[70vh] w-full bg-white" />}
      </Modal>
    </div>
  ) : (
    <span className="text-sm text-stone-500">Không có</span>
  )
}

export default function RentalApiWorkspace({ role, initialRentalId }: { role: RentalApiRole; initialRentalId?: string }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  return <WorkspaceSession key={`${identity}:${initialRentalId ?? ""}`} role={role} initialRentalId={initialRentalId} />
}

function WorkspaceSession({ role, initialRentalId }: { role: RentalApiRole; initialRentalId?: string }) {
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
  const [rentalFilterDraft, setRentalFilterDraft] = useState(nq.rentalId || "")
  const dataTab = tab === "renewal" ? "renewal" : "rental"
  const query = dataTab === "rental" ? rq : nq
  const read = useRentalApiResource(
    `${identity}:${dataTab}:${JSON.stringify(query)}`,
    async () =>
      dataTab === "rental"
        ? { kind: "rental" as const, page: await listRentals(role, rq) }
        : { kind: "renewal" as const, page: await listRenewals(role, nq) },
  )
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
      const end = new Date(`${date}T00:00:00Z`)
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
          endTo: end.toISOString().slice(0, 10),
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
      <h1 className="text-2xl font-bold">
        {role === "manager" ? "Hồ sơ thuê & Gia hạn" : "Hồ sơ thuê"}
      </h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Tổng hồ sơ",
          "Đang hiệu lực",
          "Hết hạn trong 30 ngày",
          "Yêu cầu gia hạn",
        ].map((label, i) => (
          <Card className="p-4" key={label}>
            <p className="text-sm text-stone-500">{label}</p>
            <p className="text-2xl font-bold">
              {counts.loading ? "…" : (counts.data?.[i] ?? copy("—"))}
            </p>
          </Card>
        ))}
      </div>
      {counts.error ? (
        <ApiReadState {...counts} retry={counts.refresh} />
      ) : null}
      <div className="flex flex-wrap gap-2">
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
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ thuê hoặc gia hạn</caption>
              <colgroup>
                {read.data.kind === "rental" ? (
                  <>
                    <col className="w-[20%]" />
                    <col className="w-[17%]" />
                    <col className="w-[21%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </>
                ) : (
                  <>
                    <col className="w-[19%]" />
                    <col className="w-[17%]" />
                    <col className="w-[22%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                  </>
                )}
              </colgroup>
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Mã hồ sơ",
                    "Khách hàng",
                    "Gian kho / Loại",
                    "Thời hạn",
                    ...(read.data.kind === "rental" ? ["Hợp đồng"] : []),
                    ...(read.data.kind === "renewal" ? ["Trạng thái"] : []),
                    "Thao tác",
                  ].map((h, i) => (
                    <th key={i} className="p-3 text-left align-middle font-semibold text-stone-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {read.data.page.data.map((row) => (
                  <tr key={row.id} className="border-t border-stone-200 odd:bg-white even:bg-stone-50/50 hover:bg-amber-50/40">
                    <td className="p-3 align-middle">
                      <code
                        className="block break-all rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 font-mono text-xs leading-5 tracking-tight text-stone-700"
                        title={row.id}
                      >
                        {row.id}
                      </code>
                    </td>
                    <td className="p-3 align-middle">
                      <p className="font-semibold text-stone-900">{row.customer.fullName}</p>
                    </td>
                    <td className="p-3 align-middle">
                      <p className="font-mono text-sm font-semibold text-stone-800">{row.storageUnit.code}</p>
                      {"unitType" in row && (
                        <p className="mt-1 text-xs leading-4 text-stone-500">{copy(row.unitType.name)}</p>
                      )}
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap">
                      {"contractEndDate" in row
                        ? rentalPeriodText(row, role === "manager")
                        : rentalDate(row.newEndDate)}
                    </td>
                    {read.data!.kind === "rental" && (
                      <td className="p-3 align-middle">
                        <RentalContractCell role={role} rentalId={row.id} />
                      </td>
                    )}
                    {read.data!.kind === "renewal" && (() => {
                      const renewal = row as RenewalApiRecord
                      const failed = ["payment_failed", "payment_expired", "rejected", "cancelled"].includes(renewal.status)
                      const complete = ["completed", "full_rent_paid", "deposit_paid"].includes(renewal.status)
                      const tone = failed ? "bg-red-50 text-red-700" : complete ? "bg-green-50 text-green-700" : ["pending", "payment_processing"].includes(renewal.status) ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"
                      return <td className="p-3 align-middle"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{copy(renewalLabels[renewal.status] ?? renewal.status)}</span></td>
                    })()}
                    <td className="p-3 align-middle text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-20 justify-center whitespace-nowrap"
                        onClick={() =>
                          setDetail({ kind: read.data!.kind, id: row.id })
                        }
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
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
          </div>
          <Pager
            fixedSize={role === "manager"}
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
          />
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
      {action?.kind === "request" && (
        <CustomerRenewalRequestModal
          key={`${identity}:${action.rentalId}:${action.revision?.id}`}
          actorId={actor.id}
          rentalId={action.rentalId}
          revision={action.revision}
          onClose={() => setAction(undefined)}
          onSuccess={success}
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
            onRequest={
              role === "customer"
                ? () => {
                    onClose()
                    onAction({ kind: "request", rentalId: detail.id })
                  }
                : undefined
            }
          />
          {role === "customer" && <ReturnApiPanel
            role="customer"
            rentalId={detail.id}
            rentalActive={(read.data.record as RentalApiDetail).status === "active"}
            onChanged={onChanged}
          />}
        </div>
      ) : read.data?.kind === "renewal" ? (
        <div>
          <RenewalDetail
            renewal={read.data.record as RenewalApiRecord}
            role={role}
            onPaymentChange={read.refresh}
            operationsLocked={operationsLocked}
            appointmentSelection={role === "customer" && read.data.record.status === "accepted" ? (
              <RenewalOperationsPanel
                appointmentOnly
                status={read.data.record.status}
                id={detail.id}
                role="customer"
                facilityId={read.data.record.facility.id}
                customerId={read.data.record.customer.id}
                onLocked={setOperationLocked}
                onChanged={() => { read.refresh(); onChanged() }}
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
          status={(read.data.record as RenewalApiRecord).status}
          id={detail.id}
          role={role}
          {...operationOwner}
          onLocked={setOperationLocked}
          onChanged={() => {
            read.refresh()
            onChanged()
          }}
        />
      )}
    </Modal>
  )
}
