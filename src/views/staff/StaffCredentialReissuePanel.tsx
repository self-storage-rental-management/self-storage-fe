import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, SectionHeader, Select } from '../../components/ui'
import {
  listStaffAccessCredentials,
  recordCredentialAccess,
  reissueAccessCredential,
  type AccessCredential,
  type ReissueAccessCredentialRequest,
} from '../../services/checkInApi'
import { staffErrorMessage } from './staffPresentation'

const verificationMethods: Array<{ value: ReissueAccessCredentialRequest['verificationMethod']; label: string }> = [
  { value: 'ID_DOCUMENT', label: 'Đối chiếu CCCD/hộ chiếu' },
  { value: 'CUSTOMER_ACCOUNT', label: 'Đối chiếu tài khoản khách hàng' },
  { value: 'AUTHORIZED_REPRESENTATIVE', label: 'Đối chiếu người được ủy quyền' },
  { value: 'OTHER', label: 'Phương thức khác theo quy trình' },
]

const typeLabel: Record<AccessCredential['type'], string> = {
  PIN: 'Mã truy cập',
  CARD: 'Thẻ ra vào',
  KEY: 'Chìa khóa',
  LOCK: 'Khóa / ổ khóa',
}

export default function StaffCredentialReissuePanel({ showToast }: { showToast: (message: string) => void }) {
  const [credentials, setCredentials] = useState<AccessCredential[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [identityVerified, setIdentityVerified] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState<ReissueAccessCredentialRequest['verificationMethod']>('ID_DOCUMENT')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [secret, setSecret] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessResult, setAccessResult] = useState<{ allowed: boolean; reason: string; duringSetup: boolean } | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    void listStaffAccessCredentials({ status: 'ACTIVE', q: query.trim(), page: 0, pageSize: 100 })
      .then((response) => setCredentials(response.data.filter((item) => item.status === 'ACTIVE' && Boolean(item.rentalId))))
      .catch((reasonValue) => setError(staffErrorMessage(reasonValue, 'Không thể tải quyền truy cập của các hợp đồng đang hoạt động.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [query])

  const selected = useMemo(() => credentials.find((item) => item.id === selectedId) ?? null, [credentials, selectedId])

  const selectCredential = (value: string) => {
    const item = credentials.find((credential) => credential.id === value)
    setSelectedId(value)
    setReference('')
    setSecret('')
    setReason('')
    setNote('')
    setIdentityVerified(false)
    setAccessResult(null)
    if (item) setVerificationMethod('ID_DOCUMENT')
  }

  const submit = async () => {
    if (!selected?.rentalId || !identityVerified || !reason.trim() || !reference.trim()) return
    setBusy(true)
    setError(null)
    try {
      await reissueAccessCredential(selected.rentalId, {
        credentialId: selected.id,
        identityVerified,
        verificationMethod,
        reason: reason.trim(),
        reference: reference.trim(),
        secret: secret.trim() || undefined,
        note: note.trim() || undefined,
      })
      showToast(`Đã thu hồi ${typeLabel[selected.type].toLowerCase()} cũ và cấp quyền mới cho ${selected.storageUnitCode}.`)
      setSelectedId('')
      setIdentityVerified(false)
      setReason('')
      setReference('')
      setSecret('')
      setNote('')
      refresh()
    } catch (reasonValue) {
      setError(staffErrorMessage(reasonValue, 'Không thể thay quyền truy cập cho hợp đồng này.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <SectionHeader
        title="Thay chìa khóa / mã truy cập"
        subtitle="Dùng khi khách đang thuê làm mất chìa khóa, mất thẻ, làm lộ mã truy cập hoặc cần thay khóa. Hệ thống thu hồi quyền truy cập cũ và cấp quyền mới trong cùng một giao dịch."
      />
      {error && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Tìm khách hàng / gian kho / mã tham chiếu" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập từ khóa" />
        <label className="block text-sm font-medium text-stone-700">
          Quyền truy cập đang hoạt động
          <select className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={selectedId} disabled={loading || busy} onChange={(event) => selectCredential(event.target.value)}>
            <option value="">{loading ? 'Đang tải…' : 'Chọn quyền cần thay'}</option>
            {credentials.map((item) => <option key={item.id} value={item.id}>{item.customerName} · {item.storageUnitCode} · {typeLabel[item.type]} · {item.reference}</option>)}
          </select>
        </label>
      </div>
      {!loading && !credentials.length && <p className="mt-3 text-sm text-stone-500">Không có quyền truy cập đang hoạt động gắn với hợp đồng thuê.</p>}
      {selected && (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm"><b>{selected.customerName}</b><span>·</span><span>{selected.storageUnitCode}</span><Badge variant="warning">{typeLabel[selected.type]}</Badge><span className="font-mono text-xs">Cũ: {selected.reference}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white/70 p-3 text-sm">
            <div><b>Kiểm soát truy cập</b><p className="mt-1 text-xs text-amber-900">Ghi log mỗi lượt mở khóa trong setup; backend chỉ cho phép trong giờ mở cửa cơ sở.</p></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => {
              void recordCredentialAccess(selected.id, { source: 'STAFF_CREDENTIAL_PANEL' })
                .then((result) => {
                  setAccessResult(result)
                  showToast(result.allowed ? 'Đã ghi nhận lượt truy cập hợp lệ.' : `Đã ghi nhận lượt truy cập bị từ chối: ${result.reason}.`)
                })
                .catch((reasonValue) => setError(staffErrorMessage(reasonValue, 'Không thể ghi nhận lượt truy cập.')))
            }}>Ghi nhận truy cập hiện tại</Button>
            {accessResult && <p className={`basis-full text-xs ${accessResult.allowed ? 'text-emerald-800' : 'text-red-800'}`} role="status">{accessResult.allowed ? 'Được phép' : 'Bị từ chối'} · {accessResult.reason}{accessResult.duringSetup ? ' · đang trong setup' : ''}</p>}
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={identityVerified} disabled={busy} onChange={(event) => setIdentityVerified(event.target.checked)} className="mt-1" /> <span><b>Đã xác minh khách hàng</b><span className="block text-xs text-amber-900">Chỉ tiếp tục sau khi đối chiếu khách hàng hoặc người được ủy quyền theo quy trình.</span></span></label>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Cách xác minh" value={verificationMethod} disabled={busy} onChange={(event) => setVerificationMethod(event.target.value as ReissueAccessCredentialRequest['verificationMethod'])}>{verificationMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select>
            <Input label="Mã tham chiếu mới / số seri mới" value={reference} maxLength={160} disabled={busy} onChange={(event) => setReference(event.target.value)} placeholder="Không nhập mã truy cập gốc vào mã tham chiếu" />
          </div>
          {selected.type === 'PIN' && <Input label="Mã truy cập mới (không lưu dạng gốc)" type="password" autoComplete="off" value={secret} maxLength={200} disabled={busy} onChange={(event) => setSecret(event.target.value)} />}
          <Input label="Lý do thay quyền truy cập" value={reason} maxLength={1000} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: khách báo mất chìa khóa tại quầy" />
          <Input label="Ghi chú bàn giao (tùy chọn)" value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} />
          <div className="flex justify-end"><Button disabled={busy || !identityVerified || !reason.trim() || !reference.trim()} onClick={() => void submit()}>{busy ? 'Đang thu hồi và cấp lại…' : 'Xác nhận thay quyền truy cập'}</Button></div>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-500">Không hiển thị hoặc lưu mã truy cập gốc trong danh sách. Chỉ mã tham chiếu được trả về để đối chiếu.</p>
    </Card>
  )
}
