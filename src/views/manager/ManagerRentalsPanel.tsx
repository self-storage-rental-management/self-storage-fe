import { useMemo, useState } from "react"

import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SectionHeader,
  Select,
  StatCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "../../components/ui"

import { Icon } from "../../components/Layout"

import { useLanguage } from "../../i18n/LanguageContext"

import type { User } from "../../types"

import type {
  RenewalRecord,
  RentalRecord,
  StorageContract,
} from "../../types/storageHub"
import { managerDateLabel, managerStatusLabel, managerUnitTypeLabel } from "./managerI18n"

interface Props {
  user: User

  rentals: RentalRecord[]

  contracts: StorageContract[]

  renewals: RenewalRecord[]

  approveRenewal: (renewalId: string, manager: User) => void

  rejectRenewal: (renewalId: string, manager: User, reason: string) => void

  showToast: (message: string) => void
}

const rentalVariants: Record<string, string> = {
  active: "success",
  return_requested: "warning",
  return_inspection: "warning",
  closing: "warning",
  completed: "muted",
}

export default function ManagerRentalsPanel({
  user,
  rentals,
  contracts,
  renewals,
  approveRenewal,
  rejectRenewal,
  showToast,
}: Props) {
  const { lang, formatCurrency } = useLanguage()
  const [query, setQuery] = useState("")

  const [filter, setFilter] = useState("all")

  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(
    null,
  )

  const facilityRentals = useMemo(
    () =>
      rentals.filter(
        (rental) =>
          !user.facility ||
          user.facility === "All facilities" ||
          rental.facilityName === user.facility ||
          rental.facilityId === user.facility,
      ),
    [rentals, user.facility],
  )

  const facilityRenewals = renewals.filter((renewal) =>
    facilityRentals.some((rental) => rental.id === renewal.rentalId),
  )

  const visibleRentals = facilityRentals.filter((rental) => {
    const normalized = query.trim().toLowerCase()

    return (
      (filter === "all" || rental.status === filter) &&
      (!normalized ||
        [
          rental.id,
          rental.customerName,
          rental.customerEmail,
          rental.unitId,
        ].some((value) => value.toLowerCase().includes(normalized)))
    )
  })

  const decideRenewal = (renewal: RenewalRecord, approved: boolean) => {
    try {
      if (approved) approveRenewal(renewal.id, user)
      else {
        const reason = window.prompt(
          lang === "vi"
            ? "Nhập lý do từ chối gia hạn:"
            : "Enter rejection reason:",
        )

        if (!reason?.trim()) return

        rejectRenewal(renewal.id, user, reason)
      }

      showToast(
        approved
          ? lang === "vi"
            ? "Đã duyệt yêu cầu gia hạn."
            : "Renewal approved."
          : lang === "vi"
            ? "Đã từ chối yêu cầu gia hạn."
            : "Renewal rejected.",
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể xử lý gia hạn.",
      )
    }
  }

  return (
    <div className="fade-in space-y-5">
      <SectionHeader
        eyebrow={lang === "vi" ? "Hợp đồng thuê" : "Lease portfolio"}
        title={lang === "vi" ? "Hợp đồng thuê" : "Rentals"}
        subtitle={
          lang === "vi"
            ? "Theo dõi hợp đồng, thời hạn và phê duyệt gia hạn thuộc cơ sở."
            : "Facility leases, terms, contracts and renewal approvals."
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title={lang === "vi" ? "Tổng hồ sơ" : "Total rentals"}
          value={facilityRentals.length}
          icon={Icon.policy}
        />
        <StatCard
          title={lang === "vi" ? "Đang hiệu lực" : "Active"}
          value={
            facilityRentals.filter((rental) => rental.status === "active")
              .length
          }
          icon={Icon.check}
        />
        <StatCard
          title={lang === "vi" ? "Sắp hết hạn 30 ngày" : "Expiring in 30 days"}
          value={
            facilityRentals.filter((rental) => {
              const days =
                (new Date(rental.endDate).getTime() - Date.now()) / 86_400_000
              return rental.status === "active" && days >= 0 && days <= 30
            }).length
          }
          icon={Icon.clock}
        />
        <StatCard
          title={lang === "vi" ? "Chờ duyệt gia hạn" : "Pending renewals"}
          value={
            facilityRenewals.filter((renewal) => renewal.status === "pending")
              .length
          }
          icon={Icon.refresh}
        />
      </div>

      {facilityRenewals.some((renewal) => renewal.status === "pending") && (
        <Card className="border-amber-200 p-4">
          <div className="mb-3">
            <h3 className="font-bold text-stone-900">
              {lang === "vi"
                ? "Yêu cầu gia hạn chờ duyệt"
                : "Pending renewal approvals"}
            </h3>
            <p className="text-xs text-stone-500">
              {lang === "vi"
                ? "Hệ thống kiểm tra lại xung đột lịch khi quản lý duyệt."
                : "Date conflicts are revalidated when approved."}
            </p>
          </div>
          <div className="space-y-3">
            {facilityRenewals
              .filter((renewal) => renewal.status === "pending")
              .map((renewal) => (
                <div
                  key={renewal.id}
                  className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {renewal.customerName} ·{" "}
                      <span className="font-mono">{renewal.unitId}</span>
                    </p>
                    <p className="text-xs text-stone-500">
                      {managerDateLabel(renewal.oldEndDate, lang)} → {managerDateLabel(renewal.newEndDate, lang)} ·{" "}
                      {renewal.renewalMonths}{" "}
                      {lang === "vi" ? "tháng" : "months"} ·{" "}
                      {formatCurrency(renewal.renewalFee)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideRenewal(renewal, false)}
                    >
                      {lang === "vi" ? "Từ chối" : "Reject"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => decideRenewal(renewal, true)}
                    >
                      {lang === "vi" ? "Duyệt" : "Approve"}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            lang === "vi"
              ? "Tìm hợp đồng, khách hàng, email hoặc gian…"
              : "Search rental, customer, email or unit…"
          }
        />
        <Select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">
            {lang === "vi" ? "Tất cả trạng thái" : "All statuses"}
          </option>
          {["active", "return_requested", "closing", "completed"].map(
            (status) => (
              <option key={status} value={status}>
                {managerStatusLabel(status, lang)}
              </option>
            ),
          )}
        </Select>
      </div>
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>{lang === "vi" ? "Hợp đồng" : "Rental"}</Th>
              <Th>{lang === "vi" ? "Khách hàng" : "Customer"}</Th>
              <Th>{lang === "vi" ? "Gian kho" : "Unit"}</Th>
              <Th>{lang === "vi" ? "Thời hạn" : "Term"}</Th>
              <Th>{lang === "vi" ? "Đơn giá" : "Rate"}</Th>
              <Th>{lang === "vi" ? "Thanh toán" : "Payment"}</Th>
              <Th>{lang === "vi" ? "Trạng thái" : "Status"}</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {visibleRentals.map((rental) => (
              <Tr key={rental.id}>
                <Td className="font-mono text-xs font-bold">{rental.id}</Td>
                <Td>
                  <p className="font-semibold text-stone-900">
                    {rental.customerName}
                  </p>
                  <p className="text-xs text-stone-400">
                    {rental.customerEmail}
                  </p>
                </Td>
                <Td>
                  <p className="font-mono font-bold">{rental.unitId}</p>
                  <p className="text-xs text-stone-400">
                    {managerUnitTypeLabel(rental.unitType, lang)}
                  </p>
                </Td>
                <Td>
                  <p>{managerDateLabel(rental.startDate, lang)}</p>
                  <p className="text-xs text-stone-400">→ {managerDateLabel(rental.endDate, lang)}</p>
                </Td>
                <Td className="font-mono">
                  {formatCurrency(rental.monthlyRate)}/
                  {lang === "vi" ? "tháng" : "mo"}
                </Td>
                <Td>
                  <Badge
                    variant={
                      rental.paymentStatus === "paid"
                        ? "success"
                        : rental.paymentStatus === "overdue"
                          ? "error"
                          : "warning"
                    }
                  >
                    {managerStatusLabel(rental.paymentStatus, lang)}
                  </Badge>
                </Td>
                <Td>
                  <Badge variant={rentalVariants[rental.status] || "muted"}>
                    {managerStatusLabel(rental.status, lang)}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedRental(rental)}
                  >
                    {lang === "vi" ? "Chi tiết" : "Details"}
                  </Button>
                </Td>
              </Tr>
            ))}
            {!visibleRentals.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-stone-500"
                >
                  {lang === "vi"
                    ? "Không có hợp đồng phù hợp."
                    : "No matching rentals."}
                </td>
              </tr>
            )}
          </Tbody>
        </Table>
      </Card>

      <Modal
        open={Boolean(selectedRental)}
        onClose={() => setSelectedRental(null)}
        title={lang === "vi" ? "Chi tiết hợp đồng thuê" : "Rental details"}
        size="lg"
      >
        {selectedRental &&
          (() => {
            const contract = contracts.find(
              (item) =>
                item.id === selectedRental.contractId ||
                item.reservationId === selectedRental.holdId,
            )
            const rentalRenewals = renewals.filter(
              (item) => item.rentalId === selectedRental.id,
            )
            return (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Khách hàng" : "Customer"}
                    </span>
                    <br />
                    <b>{selectedRental.customerName}</b>
                  </p>
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Gian kho" : "Unit"}
                    </span>
                    <br />
                    <b className="font-mono">{selectedRental.unitId}</b>
                  </p>
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Thời hạn" : "Period"}
                    </span>
                    <br />
                    <b>
                      {managerDateLabel(selectedRental.startDate, lang)} → {managerDateLabel(selectedRental.endDate, lang)}
                    </b>
                  </p>
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Kỳ hạn tiếp theo" : "Next due"}
                    </span>
                    <br />
                    <b>{managerDateLabel(selectedRental.nextDue, lang)}</b>
                  </p>
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Tiền đảm bảo kho" : "Security deposit"}
                    </span>
                    <br />
                    <b>{formatCurrency(selectedRental.securityDeposit)}</b>
                  </p>
                  <p>
                    <span className="text-stone-400">
                      {lang === "vi" ? "Quyền truy cập" : "Access"}
                    </span>
                    <br />
                    <b>
                      {selectedRental.overlocked
                        ? managerStatusLabel("SUSPENDED", lang)
                        : selectedRental.gateCode ||
                          managerStatusLabel("REVOKED", lang)}
                    </b>
                  </p>
                </div>
                {contract && (
                  <div className="rounded-lg border border-stone-200 p-3">
                    <p className="font-semibold">{contract.contractNumber}</p>
                    <p className="text-xs text-stone-500">
                      {lang === "vi" ? "Đã ký" : "Signed"} {managerDateLabel(contract.signedAt, lang)} ·{" "}
                      {contract.scannedFileName}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-2 font-semibold">
                    {lang === "vi" ? "Lịch sử gia hạn" : "Renewal history"}
                  </p>
                  {rentalRenewals.length ? (
                    rentalRenewals.map((item) => (
                      <p
                        key={item.id}
                        className="border-t border-stone-100 py-2"
                      >
                        {item.id} · {managerStatusLabel(item.status, lang)} ·{" "}
                        {managerDateLabel(item.oldEndDate, lang)} → {managerDateLabel(item.newEndDate, lang)}
                      </p>
                    ))
                  ) : (
                    <p className="text-stone-400">
                      {lang === "vi"
                        ? "Chưa có yêu cầu gia hạn."
                        : "No renewal requests."}
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRental(null)}
                  >
                    {lang === "vi" ? "Đóng" : "Close"}
                  </Button>
                </div>
              </div>
            )
          })()}
      </Modal>
    </div>
  )
}
