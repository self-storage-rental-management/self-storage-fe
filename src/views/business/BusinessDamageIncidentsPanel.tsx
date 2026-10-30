import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, Select, Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui'
import { isApiAuthenticated } from '../../services/authApi'
import {
  createDamageIncident,
  listDamageIncidents,
  updateDamageIncidentStatus,
  type DamageCause,
  type DamageIncidentApi,
  type IncidentSeverity,
  type IncidentStatus,
} from '../../services/incidentApi'
import type { User } from '../../types'
import { notifyBell } from '../../services/notificationApi'

interface Props {
  user: User
  lang?: string
  facilitiesList: Array<{ id: string; name: string; code?: string }>
}

const causeLabels: Record<DamageCause, { vi: string; en: string }> = {
  NATURE: { vi: 'Thiên tai / Thời tiết', en: 'Nature / Weather' },
  HUMAN: { vi: 'Tác động con người', en: 'Human Action' },
  WEAR_AND_TEAR: { vi: 'Hao mòn tự nhiên', en: 'Wear & Tear' },
  UNKNOWN: { vi: 'Chưa xác định', en: 'Unknown' },
}

const severityLabels: Record<IncidentSeverity, { vi: string; en: string; variant: 'muted' | 'info' | 'warning' | 'error' }> = {
  LOW: { vi: 'Thấp', en: 'Low', variant: 'muted' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', variant: 'info' },
  HIGH: { vi: 'Cao', en: 'High', variant: 'warning' },
  CRITICAL: { vi: 'Nghiêm trọng', en: 'Critical', variant: 'error' },
}

const statusLabels: Record<IncidentStatus, { vi: string; en: string; variant: 'muted' | 'info' | 'warning' | 'success' | 'purple' }> = {
  REPORTED: { vi: 'Mới báo cáo', en: 'Reported', variant: 'info' },
  INVESTIGATING: { vi: 'Đang điều tra', en: 'Investigating', variant: 'warning' },
  CONFIRMED: { vi: 'Đã xác nhận', en: 'Confirmed', variant: 'purple' },
  RESOLVED: { vi: 'Đã khắc phục', en: 'Resolved', variant: 'success' },
  CLOSED: { vi: 'Đã đóng hồ sơ', en: 'Closed', variant: 'muted' },
}

export default function BusinessDamageIncidentsPanel({ user, lang = 'vi', facilitiesList }: Props) {
  const isVi = lang === 'vi'

  // Facilities accessible to current user
  const allowedFacilityId = user.facilityId || undefined
  const displayFacilities = useMemo(() => {
    if (allowedFacilityId) {
      return facilitiesList.filter(f => f.id === allowedFacilityId)
    }
    return facilitiesList
  }, [facilitiesList, allowedFacilityId])

  // Filters
  const [selectedFacility, setSelectedFacility] = useState<string>(allowedFacilityId || 'all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Data & loading
  const [incidents, setIncidents] = useState<DamageIncidentApi[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const showToast = (msg: string) => {
    notifyBell({
      title: isVi ? 'Sự cố & Bồi thường' : 'Damage Incidents',
      message: msg,
      page: 'damage-incidents',
      date: new Date().toISOString()
    })
  }

  const fetchIncidents = async () => {
    if (!isApiAuthenticated()) return
    setLoading(true)
    try {
      const facilityIdParam = selectedFacility !== 'all' ? selectedFacility : allowedFacilityId
      const statusParam = selectedStatus !== 'all' ? (selectedStatus as IncidentStatus) : undefined
      const severityParam = selectedSeverity !== 'all' ? (selectedSeverity as IncidentSeverity) : undefined

      const data = await listDamageIncidents({
        facilityId: facilityIdParam,
        status: statusParam,
        severity: severityParam,
      })
      setIncidents(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể tải danh sách sự cố.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchIncidents()
  }, [selectedFacility, selectedStatus, selectedSeverity])

  // Filtered in-memory by search
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        inc.incidentCode.toLowerCase().includes(q) ||
        inc.facilityName.toLowerCase().includes(q) ||
        (inc.storageUnitCode && inc.storageUnitCode.toLowerCase().includes(q)) ||
        inc.description.toLowerCase().includes(q) ||
        (inc.reportedByName && inc.reportedByName.toLowerCase().includes(q))
      )
    })
  }, [incidents, searchQuery])

  // KPIs
  const stats = useMemo(() => {
    const total = incidents.length
    const open = incidents.filter(i => ['REPORTED', 'INVESTIGATING', 'CONFIRMED'].includes(i.status)).length
    const critical = incidents.filter(i => ['HIGH', 'CRITICAL'].includes(i.severity)).length
    const resolved = incidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status)).length
    return { total, open, critical, resolved }
  }, [incidents])

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [activeIncident, setActiveIncident] = useState<DamageIncidentApi | null>(null)

  // Form: Create
  const [formFacilityId, setFormFacilityId] = useState<string>(allowedFacilityId || (facilitiesList[0]?.id ?? ''))
  const [formStorageUnitCode, setFormStorageUnitCode] = useState<string>('')
  const [formCause, setFormCause] = useState<DamageCause>('WEAR_AND_TEAR')
  const [formSeverity, setFormSeverity] = useState<IncidentSeverity>('MEDIUM')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formOccurredAt, setFormOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 16))
  const [formEvidencePhoto, setFormEvidencePhoto] = useState<string>('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const handleOpenCreate = () => {
    setFormFacilityId(allowedFacilityId || (displayFacilities[0]?.id ?? ''))
    setFormStorageUnitCode('')
    setFormCause('WEAR_AND_TEAR')
    setFormSeverity('MEDIUM')
    setFormDescription('')
    setFormOccurredAt(new Date().toISOString().slice(0, 16))
    setFormEvidencePhoto('')
    setCreateModalOpen(true)
  }

  const handleCreateSubmit = async () => {
    if (!formFacilityId) {
      showToast(isVi ? 'Vui lòng chọn cơ sở phát sinh sự cố.' : 'Please select facility.')
      return
    }
    if (!formDescription.trim()) {
      showToast(isVi ? 'Vui lòng nhập mô tả chi tiết sự cố.' : 'Please provide description.')
      return
    }
    setCreateSubmitting(true)
    try {
      await createDamageIncident({
        facilityId: formFacilityId,
        cause: formCause,
        severity: formSeverity,
        description: formDescription.trim(),
        occurredAt: new Date(formOccurredAt).toISOString(),
        evidencePhotosJson: formEvidencePhoto.trim() ? JSON.stringify([formEvidencePhoto.trim()]) : null,
      })
      showToast(isVi ? 'Ghi nhận sự cố hư hỏng thành công!' : 'Incident reported successfully!')
      setCreateModalOpen(false)
      await fetchIncidents()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi tạo sự cố.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Form: Status Update
  const [nextStatus, setNextStatus] = useState<IncidentStatus>('INVESTIGATING')
  const [resolutionNotes, setResolutionNotes] = useState<string>('')
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  const handleOpenStatusModal = (inc: DamageIncidentApi) => {
    setActiveIncident(inc)
    setNextStatus(inc.status)
    setResolutionNotes(inc.resolutionNotes || '')
    setStatusModalOpen(true)
  }

  const handleStatusSubmit = async () => {
    if (!activeIncident) return
    if ((nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && !resolutionNotes.trim()) {
      showToast(isVi ? 'Bắt buộc nhập ghi chú khắc phục / xử lý khi chuyển sang RESOLVED hoặc CLOSED!' : 'Resolution notes required!')
      return
    }
    setStatusSubmitting(true)
    try {
      await updateDamageIncidentStatus(activeIncident.id, {
        status: nextStatus,
        resolutionNotes: resolutionNotes.trim() || null,
      })
      showToast(isVi ? `Đã cập nhật trạng thái sự cố [${activeIncident.incidentCode}] sang ${statusLabels[nextStatus][lang === 'vi' ? 'vi' : 'en']}` : 'Status updated.')
      setStatusModalOpen(false)
      await fetchIncidents()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.')
    } finally {
      setStatusSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <span>🛡️</span>
            {isVi ? 'Quản Lý Sự Cố & Hư Hỏng Kho' : 'Damage Incidents Management'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isVi
              ? 'Theo dõi, phân loại và cập nhật tiến độ xử lý sự cố kho lưu trữ và cơ sở hạ tầng chung.'
              : 'Record, classify, and track operational damage incidents across storage facilities.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchIncidents} disabled={loading}>
            🔄 {isVi ? 'Làm mới' : 'Refresh'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            ➕ {isVi ? 'Báo Cáo Sự Cố Mới' : 'Report Incident'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-stone-200 bg-white">
          <div className="text-xs text-stone-500 font-medium">{isVi ? 'Tổng số sự cố' : 'Total Incidents'}</div>
          <div className="text-2xl font-bold text-stone-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">{isVi ? 'Hồ sơ đã ghi nhận' : 'Logged cases'}</div>
        </Card>
        <Card className="p-4 border border-amber-200 bg-amber-50/50">
          <div className="text-xs text-amber-800 font-medium">{isVi ? 'Đang điều tra / Xử lý' : 'Active In-Progress'}</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{stats.open}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">{isVi ? 'Chưa hoàn tất xử lý' : 'Pending resolution'}</div>
        </Card>
        <Card className="p-4 border border-red-200 bg-red-50/50">
          <div className="text-xs text-red-800 font-medium">{isVi ? 'Mức độ nghiêm trọng cao' : 'High / Critical'}</div>
          <div className="text-2xl font-bold text-red-900 mt-1">{stats.critical}</div>
          <div className="text-[11px] text-red-700 mt-0.5">{isVi ? 'Cần can thiệp ưu tiên' : 'High priority'}</div>
        </Card>
        <Card className="p-4 border border-emerald-200 bg-emerald-50/50">
          <div className="text-xs text-emerald-800 font-medium">{isVi ? 'Đã khắc phục / Đóng' : 'Resolved / Closed'}</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{stats.resolved}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">{isVi ? 'Đã có biên bản giải quyết' : 'With resolution notes'}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 border border-stone-200 bg-stone-50/70">
        <div className="flex flex-wrap items-center gap-3">
          {/* Facility filter */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Cơ sở' : 'Facility'}
            </label>
            <select
              value={selectedFacility}
              onChange={e => setSelectedFacility(e.target.value)}
              disabled={!!allowedFacilityId}
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            >
              {!allowedFacilityId && <option value="all">{isVi ? 'Toàn bộ cơ sở' : 'All Facilities'}</option>}
              {displayFacilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="w-40">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Trạng thái' : 'Status'}
            </label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">{isVi ? 'Tất cả trạng thái' : 'All Statuses'}</option>
              {(Object.keys(statusLabels) as IncidentStatus[]).map(st => (
                <option key={st} value={st}>{statusLabels[st][isVi ? 'vi' : 'en']}</option>
              ))}
            </select>
          </div>

          {/* Severity filter */}
          <div className="w-36">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Mức độ' : 'Severity'}
            </label>
            <select
              value={selectedSeverity}
              onChange={e => setSelectedSeverity(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">{isVi ? 'Tất cả mức độ' : 'All Severities'}</option>
              {(Object.keys(severityLabels) as IncidentSeverity[]).map(sv => (
                <option key={sv} value={sv}>{severityLabels[sv][isVi ? 'vi' : 'en']}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              {isVi ? 'Tìm kiếm' : 'Search'}
            </label>
            <input
              type="text"
              placeholder={isVi ? 'Tìm mã sự cố, gian kho, mô tả...' : 'Search incident code, unit, text...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-stone-200 overflow-hidden bg-white shadow-sm">
        <Table>
          <Thead>
            <Tr>
              <Th className="text-xs py-3 px-3">{isVi ? 'Mã sự cố' : 'Code'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Cơ sở & Vị trí' : 'Facility & Unit'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Nguyên nhân' : 'Cause'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Mức độ' : 'Severity'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Trạng thái' : 'Status'}</Th>
              <Th className="text-xs py-3 px-3">{isVi ? 'Thời gian' : 'Occurred'}</Th>
              <Th className="text-xs py-3 px-3 text-right">{isVi ? 'Thao tác' : 'Actions'}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr>
                <Td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                  {isVi ? 'Đang tải dữ liệu...' : 'Loading incidents...'}
                </Td>
              </Tr>
            ) : filteredIncidents.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                  {isVi ? 'Không có sự cố nào phù hợp với bộ lọc.' : 'No damage incidents found.'}
                </Td>
              </Tr>
            ) : (
              filteredIncidents.map(inc => {
                const sev = severityLabels[inc.severity] || severityLabels.MEDIUM
                const st = statusLabels[inc.status] || statusLabels.REPORTED
                const cause = causeLabels[inc.cause] || causeLabels.UNKNOWN

                return (
                  <Tr key={inc.id} className="hover:bg-stone-50/70 transition border-b border-stone-100">
                    <Td className="py-3 px-3 font-mono font-bold text-xs text-stone-900">
                      {inc.incidentCode}
                    </Td>
                    <Td className="py-3 px-3">
                      <div className="font-semibold text-xs text-stone-900">{inc.facilityName}</div>
                      <div className="text-[11px] text-stone-500">
                        {inc.storageUnitCode ? (
                          <span className="font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Unit: {inc.storageUnitCode}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">
                            {isVi ? 'Hạ tầng chung cơ sở' : 'Common Infrastructure'}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="py-3 px-3 text-xs text-stone-700">
                      {cause[isVi ? 'vi' : 'en']}
                    </Td>
                    <Td className="py-3 px-3">
                      <Badge variant={sev.variant}>
                        {sev[isVi ? 'vi' : 'en']}
                      </Badge>
                    </Td>
                    <Td className="py-3 px-3">
                      <Badge variant={st.variant}>
                        {st[isVi ? 'vi' : 'en']}
                      </Badge>
                    </Td>
                    <Td className="py-3 px-3 text-xs text-stone-500">
                      <div>{new Date(inc.occurredAt).toLocaleDateString('vi-VN')}</div>
                      <div className="text-[10px] text-stone-400">{inc.reportedByName || 'Staff'}</div>
                    </Td>
                    <Td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveIncident(inc)
                            setDetailModalOpen(true)
                          }}
                        >
                          👁️ {isVi ? 'Chi tiết' : 'View'}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenStatusModal(inc)}
                        >
                          ⚡ {isVi ? 'Cập nhật' : 'Update'}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
      </Card>

      {/* Modal: Create Incident */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title={isVi ? 'Báo Cáo Sự Cố / Hư Hỏng Kho' : 'Report Damage Incident'}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Cơ sở xảy ra sự cố *' : 'Facility *'}
              </label>
              <select
                value={formFacilityId}
                onChange={e => setFormFacilityId(e.target.value)}
                disabled={!!allowedFacilityId}
                className="w-full border border-stone-300 rounded-lg p-2 bg-white"
              >
                {displayFacilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Gian kho cụ thể (Tùy chọn)' : 'Storage Unit Code (Optional)'}
              </label>
              <Input
                placeholder={isVi ? 'Để trống nếu sự cố thuộc cơ sở hạ tầng chung...' : 'Leave empty for common infrastructure...'}
                value={formStorageUnitCode}
                onChange={e => setFormStorageUnitCode(e.target.value)}
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                {isVi ? 'Ghi chú: Nếu sự cố xảy ra tại hành lang, trần, hệ thống PCCC hoặc cửa chính, hãy để trống ô này.' : 'Leave empty if common facility infrastructure.'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Nguyên nhân *' : 'Cause *'}
                </label>
                <select
                  value={formCause}
                  onChange={e => setFormCause(e.target.value as DamageCause)}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                >
                  {(Object.keys(causeLabels) as DamageCause[]).map(c => (
                    <option key={c} value={c}>{causeLabels[c][isVi ? 'vi' : 'en']}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  {isVi ? 'Mức độ nghiêm trọng *' : 'Severity *'}
                </label>
                <select
                  value={formSeverity}
                  onChange={e => setFormSeverity(e.target.value as IncidentSeverity)}
                  className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                >
                  {(Object.keys(severityLabels) as IncidentSeverity[]).map(s => (
                    <option key={s} value={s}>{severityLabels[s][isVi ? 'vi' : 'en']}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Thời gian phát sinh sự cố *' : 'Occurred At *'}
              </label>
              <LocalizedDateInput
                type="datetime-local"
                value={formOccurredAt}
                onChange={e => setFormOccurredAt(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2 bg-white text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Mô tả chi tiết hiện trường / hư hỏng *' : 'Detailed Description *'}
              </label>
              <textarea
                rows={3}
                placeholder={isVi ? 'Mô tả cụ thể vết nứt, ẩm mốc, rò rỉ nước, biến dạng khóa...' : 'Describe incident details...'}
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                className="w-full border border-stone-300 rounded-lg p-2 bg-white text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Đường dẫn hình ảnh bằng chứng (URL)' : 'Evidence Photo URL'}
              </label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={formEvidencePhoto}
                onChange={e => setFormEvidencePhoto(e.target.value)}
              />
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
                {isVi ? 'Hủy' : 'Cancel'}
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateSubmit} disabled={createSubmitting}>
                {createSubmitting ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Ghi nhận sự cố' : 'Submit Incident')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Status Update */}
      {statusModalOpen && activeIncident && (
        <Modal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={`${isVi ? 'Cập Nhật Trạng Thái' : 'Update Status'} - ${activeIncident.incidentCode}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
              <div className="font-semibold text-stone-800">{activeIncident.facilityName}</div>
              <div className="text-stone-500">
                {activeIncident.storageUnitCode ? `Gian kho: ${activeIncident.storageUnitCode}` : 'Cơ sở hạ tầng chung'}
              </div>
              <div className="text-stone-600 line-clamp-2 mt-1">{activeIncident.description}</div>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Trạng thái tiếp theo *' : 'Next Status *'}
              </label>
              <select
                value={nextStatus}
                onChange={e => setNextStatus(e.target.value as IncidentStatus)}
                className="w-full border border-stone-300 rounded-lg p-2 bg-white"
              >
                {(Object.keys(statusLabels) as IncidentStatus[]).map(st => (
                  <option key={st} value={st}>{statusLabels[st][isVi ? 'vi' : 'en']}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                {isVi ? 'Ghi chú giải quyết / Biên bản xử lý' : 'Resolution Notes'}
                {(nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && (
                  <span className="text-red-500 font-bold ml-1">({isVi ? 'Bắt buộc khi giải quyết/đóng' : 'Required'})</span>
                )}
              </label>
              <textarea
                rows={3}
                placeholder={
                  (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED')
                    ? (isVi ? 'Nhập chi tiết biện pháp khắc phục, ngày hoàn tất, người kiểm tra...' : 'Enter resolution details...')
                    : (isVi ? 'Ghi chú tiến độ hoặc nguyên nhân bổ sung...' : 'Optional progress note...')
                }
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                className={`w-full border rounded-lg p-2 bg-white text-xs ${
                  (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && !resolutionNotes.trim()
                    ? 'border-red-300 ring-1 ring-red-200'
                    : 'border-stone-300'
                }`}
              />
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
                {isVi ? 'Hủy' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStatusSubmit}
                disabled={statusSubmitting || ((nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && !resolutionNotes.trim())}
              >
                {statusSubmitting ? (isVi ? 'Đang cập nhật...' : 'Updating...') : (isVi ? 'Lưu thay đổi' : 'Save Status')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: View Details */}
      {detailModalOpen && activeIncident && (
        <Modal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`${isVi ? 'Chi Tiết Sự Cố' : 'Incident Details'} - ${activeIncident.incidentCode}`}
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{isVi ? 'Cơ sở' : 'Facility'}:</span>
                <span className="font-semibold text-stone-800">{activeIncident.facilityName}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Gian kho' : 'Unit'}:</span>
                <span className="font-semibold text-stone-800">
                  {activeIncident.storageUnitCode || (isVi ? 'Hạ tầng chung' : 'Common Infrastructure')}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Nguyên nhân' : 'Cause'}:</span>
                <span className="font-semibold text-stone-800">{causeLabels[activeIncident.cause][isVi ? 'vi' : 'en']}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Mức độ' : 'Severity'}:</span>
                <Badge variant={severityLabels[activeIncident.severity].variant}>
                  {severityLabels[activeIncident.severity][isVi ? 'vi' : 'en']}
                </Badge>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Trạng thái' : 'Status'}:</span>
                <Badge variant={statusLabels[activeIncident.status].variant}>
                  {statusLabels[activeIncident.status][isVi ? 'vi' : 'en']}
                </Badge>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Thời gian xảy ra' : 'Occurred At'}:</span>
                <span className="font-semibold text-stone-800">{new Date(activeIncident.occurredAt).toLocaleString('vi-VN')}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Người ghi nhận' : 'Reported By'}:</span>
                <span className="font-semibold text-stone-800">{activeIncident.reportedByName || 'Staff'}</span>
              </div>
              <div>
                <span className="text-stone-400 block">{isVi ? 'Thời gian báo cáo' : 'Reported At'}:</span>
                <span className="font-semibold text-stone-800">{new Date(activeIncident.reportedAt).toLocaleString('vi-VN')}</span>
              </div>
            </div>

            <div>
              <span className="font-semibold text-stone-700 block mb-1">{isVi ? 'Mô tả hiện trường' : 'Description'}:</span>
              <div className="p-2.5 rounded-lg border border-stone-200 bg-white text-stone-800 whitespace-pre-wrap">
                {activeIncident.description}
              </div>
            </div>

            {activeIncident.resolutionNotes && (
              <div>
                <span className="font-semibold text-emerald-800 block mb-1">
                  {isVi ? 'Biên bản & Ghi chú giải quyết' : 'Resolution Notes'}:
                </span>
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 text-emerald-900 whitespace-pre-wrap font-medium">
                  {activeIncident.resolutionNotes}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-stone-200 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
                {isVi ? 'Đóng' : 'Close'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
