import { useState } from 'react'
import { Button, Card, SectionHeader, Tabs } from '../../components/ui'
import { SETTINGS_GROUPS } from '../../data/demoDatabase'
import { isApiAuthenticated } from '../../services/authApi'
import AdminSettingsApiPanel from './AdminSettingsApiPanel'

const tabs = ['Tất cả danh mục', 'Cơ sở kho', 'Thanh toán', 'Bảo mật', 'Thông báo', 'Bảo trì']

export function LegacyAdminSettingsPanel() {
  const [activeTab, setActiveTab] = useState(tabs[0])
  const groups = activeTab === tabs[0] ? SETTINGS_GROUPS : SETTINGS_GROUPS.filter(group => {
    const mapping: Record<string, string> = {
      'Cơ sở kho': 'Facility Defaults',
      'Thanh toán': 'Billing & Delinquency',
      'Bảo mật': 'Security & Access',
      'Thông báo': 'Automated Notifications',
      'Bảo trì': 'System & Maintenance',
    }
    return group.group === mapping[activeTab] || group.group.toLowerCase().includes(activeTab.toLowerCase().slice(0, 4))
  })

  return <div className="fade-in space-y-6">
    <SectionHeader title="Cấu Hình Hệ Thống & Cơ Sở Kho" subtitle="Tinh chỉnh các ngưỡng vận hành, công nợ, an ninh và thông báo tự động" action={<Button variant="outline" size="sm" disabled>Chỉ xem · Chưa kết nối backend</Button>} />
    <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
    <div className="space-y-5">
      {groups.map(group => <Card key={group.group} className="p-6">
        <div className="mb-5 flex items-start justify-between border-b border-stone-100 pb-3"><div><h3 className="text-base font-bold text-stone-900">{group.group}</h3>{group.description && <p className="mt-0.5 text-xs text-stone-500">{group.description}</p>}</div><span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-800">ĐANG ÁP DỤNG</span></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{group.items.map(item => <div key={item.id} className="space-y-1.5"><label className="block text-xs font-semibold text-stone-700">{item.label}</label>{item.type === 'toggle' ? <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-[#fbfaf6] p-2.5 text-xs text-stone-600"><input type="checkbox" defaultChecked={Boolean(item.value)} disabled className="h-4 w-4 rounded text-amber-600" />Bật / Tự động áp dụng</label> : item.type === 'select' ? <select defaultValue={item.value as string} disabled className="w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-xs text-stone-500">{item.options?.map(option => <option key={option} value={option}>{option}</option>) ?? <option value={item.value as string}>{item.value as string}</option>}</select> : <input type={item.type === 'number' ? 'number' : 'text'} defaultValue={item.value as string | number} disabled className="w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-xs text-stone-500" />}</div>)}</div>
      </Card>)}
    </div>
    <div className="flex justify-end pt-2 text-xs text-stone-500">Cấu hình đang ở chế độ chỉ xem; cần kết nối backend trước khi cho phép lưu thay đổi.</div>
  </div>
}

export default function AdminSettingsPanel(props: { user: import('../../types').User; showToast: import('./adminPanelTypes').AdminToast }) {
  return isApiAuthenticated() ? <AdminSettingsApiPanel {...props} /> : <LegacyAdminSettingsPanel />
}
