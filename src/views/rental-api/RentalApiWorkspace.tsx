import { useManagerPresentation } from "../manager/managerPresentation"
import { useEffect, useState } from "react"
import { Button, Card, Modal } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { getRental, listRentals } from "../../services/rentalApi"
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
import {
  rentalDate,
  rentalLabels,
  rentalMoney,
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
  kind: "decision"
  renewal: RenewalApiRecord
  action: "APPROVE" | "REJECT" | "CANCEL"
}

function Pager({
  page,
  pages,
  total,
  size,
  setPage,
  setSize,
}: {
  page: number
  pages: number
  total: number
  size: number
  setPage: (p: number) => void
  setSize: (s: number) => void
}) {
  const { manager, copy } = useManagerPresentation()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <span>
        {total} hồ sơ · Trang {pages ? page + 1 : 0}/{pages}
      </span>
      <div className="flex gap-2">
        <select
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
        </select>
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

export default function RentalApiWorkspace({ role }: { role: RentalApiRole }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  return <WorkspaceSession key={identity} role={role} />
}

function WorkspaceSession({ role }: { role: RentalApiRole }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${role}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}`
  const [tab, setTab] = useState<"rental" | "renewal">("rental")
  const [rq, setRq] = useState<RentalApiQuery>({
    page: 0,
    size: 20,
    sort: "createdAt,desc",
  })
  const [nq, setNq] = useState<RenewalApiQuery>({
    page: 0,
    size: 20,
    sort: "createdAt,desc",
  })
  const [search, setSearch] = useState("")
  const [detail, setDetail] = useState<Detail>()
  const [action, setAction] = useState<Action>()
  const permitted =
    actor?.status === "ACTIVE" &&
    actor.roles.includes(role === "manager" ? "MANAGER" : "CUSTOMER") &&
    (role !== "manager" || actor.permissions.includes("rentals:read"))
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "rental")
        setRq((q) => ({ ...q, search: search.trim(), page: 0 }))
      else if (role === "manager")
        setNq((q) => ({ ...q, search: search.trim(), page: 0 }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, tab, role])
  // Parent mounts this workspace keyed by actor/scope. Backend remains authority.
  if (!permitted)
    return (
      <Card className="p-5">Bạn chưa có quyền đọc hồ sơ thuê/gia hạn.</Card>
    )
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
  const query = tab === "rental" ? rq : nq
  const read = useRentalApiResource(
    `${identity}:${tab}:${JSON.stringify(query)}`,
    async () =>
      tab === "rental"
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
      ])
      return result.map((p) => p.pagination.totalItems)
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
      if (tab === "rental")
        setRq({ ...rq, page: Math.max(0, p.totalPages - 1) })
      else setNq({ ...nq, page: Math.max(0, p.totalPages - 1) })
    }
  }, [read.data, tab, rq, nq, setRq, setNq])
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">
        {role === "manager" ? "Hồ sơ thuê & Gia hạn" : "Hồ sơ thuê của tôi"}
      </h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Tổng hồ sơ",
          "Đang hiệu lực",
          "Mốc kết thúc đã lưu trong 30 ngày",
          "Gia hạn chờ duyệt",
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
      <div className="flex gap-2">
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
        {!manager && (<Button variant="outline" onClick={refresh}>
          Tải lại
        </Button>)}
      </div>
      <Card className="p-4 flex flex-wrap items-end gap-3">
        {(tab === "rental" || role === "manager") && (
          <label>
            Tìm kiếm
            <input
              className={`${inputClass} block`}
              value={search}
              maxLength={200}
              placeholder="Mã hồ sơ / gian kho"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        )}
        <label>
          Trạng thái
          <select
            className={`${inputClass} block`}
            value={query.status || ""}
            onChange={(e) =>
              change({ status: e.target.value || undefined } as RentalApiQuery)
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(
              tab === "rental" ? rentalLabels : renewalLabels,
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {role === "manager" && (
          <label>
            Cơ sở
            <select
              className={`${inputClass} block max-w-xs`}
              value={query.facilityId || ""}
              onChange={(e) => {
                setDetail(undefined)
                setAction(undefined)
                change({ facilityId: e.target.value || undefined })
              }}
            >
              <option value="">Tất cả cơ sở được đọc</option>
              {Object.keys(actor.facilityScopes).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab === "rental" && (
          <>
            <label>
              Ngày kết thúc đã lưu từ
              <input
                type="date"
                className={`${inputClass} block`}
                value={rq.endFrom || ""}
                onChange={(e) =>
                  change({ endFrom: e.target.value || undefined })
                }
              />
            </label>
            <label>
              Ngày kết thúc đã lưu đến
              <input
                type="date"
                className={`${inputClass} block`}
                value={rq.endTo || ""}
                onChange={(e) => change({ endTo: e.target.value || undefined })}
              />
            </label>
          </>
        )}
        {tab === "renewal" && (
          <label>
            Mã hồ sơ thuê (Enter để lọc)
            <input
              className={`${inputClass} block`}
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
        <label>
          Sắp xếp
          <select
            className={`${inputClass} block`}
            value={query.sort || "createdAt,desc"}
            onChange={(e) => change({ sort: e.target.value })}
          >
            <option value="createdAt,desc">Mới nhất</option>
            <option value="createdAt,asc">Cũ nhất</option>
            <option
              value={
                tab === "rental" ? "contractEndDate,asc" : "newEndDate,asc"
              }
            >
              {tab === "rental" ? "Mốc kết thúc đã lưu gần nhất" : "Ngày kết thúc đề nghị gần nhất"}
            </option>
            <option
              value={tab === "rental" ? "monthlyPrice,desc" : "amount,desc"}
            >
              Giá giảm dần
            </option>
          </select>
        </label>
      </Card>
      <ApiReadState {...read} retry={refresh} />
      {read.data && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Mã hồ sơ",
                    "Khách hàng / Cơ sở",
                    "Gian kho / Loại",
                    "Thời hạn",
                    "Đơn giá / Tiền gia hạn",
                    "Trạng thái",
                    "",
                  ].map((h, i) => (
                    <th key={i} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {read.data.page.data.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 max-w-48 break-all">{row.id}</td>
                    <td className="p-3">
                      {row.customer.fullName}
                      <br />
                      {row.facility.name}
                    </td>
                    <td className="p-3">
                      {row.storageUnit.code}
                      <br />
                      {"unitType" in row ? copy(row.unitType.name) : ""}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {"contractEndDate" in row
                        ? rentalPeriodText(row)
                        : rentalDate(row.newEndDate)}
                    </td>
                    <td className="p-3">
                      {"monthlyPrice" in row
                        ? rentalMoney(row.monthlyPrice, row.currency)
                        : rentalMoney(row.amount, row.currency)}
                    </td>
                    <td className="p-3">
                      {
                        (read.data!.kind === "rental"
                          ? rentalLabels
                          : renewalLabels)[row.status]
                      }
                      {"dataWarnings" in row && row.dataWarnings.length > 0 && (
                        <p className="text-amber-700">Có cảnh báo dữ liệu</p>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
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
                    <td colSpan={7} className="p-6 text-center">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager
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
      {action?.kind === "decision" && (
        <RenewalDecisionModal
          key={`${identity}:${action.renewal.id}:${action.action}`}
          renewal={action.renewal}
          action={action.action}
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

  const [operationLocked, setOperationLocked] = useState(false)
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
        if (!operationLocked) onClose()
      }}
    >
      <ApiReadState {...read} retry={read.refresh} />
      {read.data?.kind === "rental" ? (
        <RentalDetail
          rental={read.data.record as RentalApiDetail}
          onRequest={
            role === "customer"
              ? () => {
                  onClose()
                  onAction({ kind: "request", rentalId: detail.id })
                }
              : undefined
          }
        />
      ) : read.data?.kind === "renewal" ? (
        <div>
          <RenewalDetail
            renewal={read.data.record as RenewalApiRecord}
            role={role}
            onAction={(action) => {
              if (operationLocked) return
              const renewal = read.data!.record as RenewalApiRecord
              onClose()
              if (action === "ACCEPT_REVISED_QUOTE")
                onAction({
                  kind: "request",
                  rentalId: renewal.rentalId,
                  revision: renewal,
                })
              else onAction({ kind: "decision", renewal, action })
            }}
          />
        </div>
      ) : null}
      {detail.kind === "renewal" && operationOwner && (
        <RenewalOperationsPanel
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
