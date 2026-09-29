import { useEffect, useMemo, useState } from 'react'
import { Button, Card, SectionHeader, Tabs } from '../../components/ui'
import { listAdminSettings, updateAdminSetting, type AdminApiSetting } from '../../services/adminApi'
import type { AdminToast } from './adminPanelTypes'

const tabs = ['Tất cả danh mục', 'Cơ sở kho', 'Thanh toán', 'Bảo mật', 'Thông báo', 'Bảo trì']
const groupNames: Record<string, string> = {
  'Cơ sở kho': 'Facility & Business Profile',
  'Thanh toán': 'Billing & Invoicing Rules',
  'Bảo mật': 'Security & Access Controls',
  'Thông báo': 'Automated Notifications & Webhooks',
  'Bảo trì': 'Maintenance & Service Mode',
}

export default function AdminSettingsApiPanel({ showToast }: { user: import('../../types').User; showToast: AdminToast }) {
  const [settings, setSettings] = useState<AdminApiSetting[]>([])
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [drafts, setDrafts] = useState<Record<string, string | number | boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listAdminSettings().then(items => {
      setSettings(items)
      setDrafts(Object.fromEntries(items.map(item => [item.id, item.value])))
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải cấu hình backend.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const groups = useMemo(() => {
    const filtered = activeTab === tabs[0] ? settings : settings.filter(item => item.group === groupNames[activeTab])
    return Array.from(new Set(filtered.map(item => item.group))).map(group => ({ group, items: filtered.filter(item => item.group === group) }))
  }, [activeTab, settings])

  const save = async (item: AdminApiSetting) => {
    setSaving(item.id)
    try {
      const updated = await updateAdminSetting(item.id, drafts[item.id])
      setSettings(previous => previous.map(value => value.id === updated.id ? updated : value))
      setDrafts(previous => ({ ...previous, [updated.id]: updated.value }))
      showToast(`Đã lưu cấu hình ${item.label}.`)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể lưu cấu hình.')
    } finally {
      setSaving(null)
    }
  }

  return <div className="fade-in space-y-6">
    <SectionHeader title="Cấu Hình Hệ Thống & Cơ Sở Kho" subtitle="Mọi thay đổi được backend kiểm tra bằng quyền manage_settings và ghi ActivityLog" />
    <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={load}>Thử lại</Button></div>}
    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải cấu hình…</div> : <div className="space-y-5">{groups.map(group => <Card key={group.group} className="p-6"><div className="mb-5 border-b border-stone-100 pb-3"><h3 className="text-base font-bold text-stone-900">{group.group}</h3></div><div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{group.items.map(item => { const value = drafts[item.id] ?? item.value; return <div key={item.id} className="space-y-1.5"><label className="block text-xs font-semibold text-stone-700">{item.label}</label>{item.type === 'toggle' ? <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-[#fbfaf6] p-2.5 text-xs text-stone-600"><input type="checkbox" checked={Boolean(value)} onChange={event => setDrafts(previous => ({ ...previous, [item.id]: event.target.checked }))} className="h-4 w-4 rounded text-amber-600" />Bật / Tự động áp dụng</label> : item.type === 'select' ? <select value={String(value)} onChange={event => setDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">{item.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input type={item.type === 'number' ? 'number' : 'text'} value={String(value)} onChange={event => setDrafts(previous => ({ ...previous, [item.id]: item.type === 'number' ? Number(event.target.value) : event.target.value }))} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700" />}<div className="flex justify-end"><Button variant="outline" size="sm" disabled={saving === item.id} onClick={() => void save(item)}>{saving === item.id ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></div></div>})}</div></Card>)}</div>}
  </div>
}
