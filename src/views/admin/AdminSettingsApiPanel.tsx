import { useEffect, useMemo, useState } from 'react'
import { Button, Card, SectionHeader, Tabs } from '../../components/ui'
import { listAdminSettings, updateAdminSetting, type AdminApiSetting } from '../../services/adminApi'
import type { AdminToast } from './adminPanelTypes'
import {
  SETTING_TAB_TO_GROUP,
  settingGroupLabel,
  settingItemDescription,
  settingItemLabel,
  settingOptionLabel,
  SETTING_GROUP_DESCRIPTIONS,
} from './adminSettingsLocalization'

// ─── Value Extraction Helpers (Fix [object Object] Bug) ──────────────────────

function extractSettingStringValue(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'boolean') return raw ? 'true' : 'false'
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('text' in obj && typeof obj.text === 'string') return obj.text
    if ('value' in obj && (typeof obj.value === 'string' || typeof obj.value === 'number')) return String(obj.value)
    if ('url' in obj && typeof obj.url === 'string') return obj.url
    if ('content' in obj && typeof obj.content === 'string') return obj.content
    if ('message' in obj && typeof obj.message === 'string') return obj.message
    if (Array.isArray(raw)) return raw.join(', ')
    try {
      const json = JSON.stringify(raw)
      return json === '{}' ? '' : json
    } catch {
      return ''
    }
  }
  return String(raw)
}

function extractSettingBooleanValue(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw === 1
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim()
    return lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes' || lower === 'enabled'
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if ('enabled' in obj && typeof obj.enabled === 'boolean') return obj.enabled
    if ('value' in obj) return extractSettingBooleanValue(obj.value)
  }
  return false
}

function extractSettingNumberValue(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[^\d.-]/g, ''))
    return Number.isNaN(parsed) ? fallback : parsed
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if ('value' in obj) return extractSettingNumberValue(obj.value, fallback)
    if ('amount' in obj) return extractSettingNumberValue(obj.amount, fallback)
  }
  return fallback
}

// ─── Toggle Switch Component (Replaces Confusing Checkbox) ───────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  labelActive = 'Đang kích hoạt',
  labelInactive = 'Đã tắt',
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  labelActive?: string
  labelInactive?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#e9a12c] focus:ring-offset-2 ${
          checked ? 'bg-emerald-600' : 'bg-stone-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-xs font-semibold select-none ${checked ? 'text-emerald-700' : 'text-stone-500'}`}>
        {checked ? labelActive : labelInactive}
      </span>
    </div>
  )
}

// ─── Category Tab Options ────────────────────────────────────────────────────

const TABS = [
  'Thông tin chung',
  'Hóa đơn & Biểu phí',
  'Bảo mật & Xác thực',
  'Thông báo tự động',
  'Bảo trì & Dịch vụ',
]

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminSettingsApiPanel({ showToast }: { user: import('../../types').User; showToast: AdminToast }) {
  const [settings, setSettings] = useState<AdminApiSetting[]>([])
  const [activeTab, setActiveTab] = useState<string>(TABS[0])
  const [drafts, setDrafts] = useState<Record<string, string | number | boolean>>({})
  const [originalValues, setOriginalValues] = useState<Record<string, string | number | boolean>>({})
  const [savingAll, setSavingAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)

    listAdminSettings()
      .then(items => {
        setSettings(items)

        // Normalize all values into clean primitives (No [object Object] strings!)
        const normalized: Record<string, string | number | boolean> = {}
        items.forEach(item => {
          if (item.type === 'toggle') {
            normalized[item.id] = extractSettingBooleanValue(item.value)
          } else if (item.type === 'number') {
            normalized[item.id] = extractSettingNumberValue(item.value)
          } else {
            normalized[item.id] = extractSettingStringValue(item.value)
          }
        })

        setOriginalValues(normalized)
        setDrafts(normalized)
      })
      .catch(reason => {
        setSettings([])
        setOriginalValues({})
        setDrafts({})
        setError(reason instanceof Error ? reason.message : 'Không thể tải cấu hình hệ thống từ cơ sở dữ liệu.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // Filter settings by the active category tab ONLY (No more massive stacked pages!)
  const activeGroup = useMemo(() => {
    const targetGroup = SETTING_TAB_TO_GROUP[activeTab] || 'Facility & Business Profile'
    const items = settings.filter(item => item.group === targetGroup)
    return {
      group: targetGroup,
      title: settingGroupLabel(targetGroup),
      description: SETTING_GROUP_DESCRIPTIONS[targetGroup] || '',
      items,
    }
  }, [activeTab, settings])

  // Track modified fields (Form Dirty State)
  const dirtyItems = useMemo(() => {
    return settings.filter(item => drafts[item.id] !== originalValues[item.id])
  }, [settings, drafts, originalValues])

  const dirtyCount = dirtyItems.length
  const hasChanges = dirtyCount > 0

  const handleDraftChange = (id: string, value: string | number | boolean) => {
    setDrafts(prev => ({ ...prev, [id]: value }))
  }

  const handleDiscardChanges = () => {
    setDrafts(originalValues)
    showToast('Đã hủy bỏ tất cả thay đổi chưa lưu.')
  }

  const handleSaveAll = async () => {
    if (!hasChanges) return
    setSavingAll(true)

    try {
      // Send updates for modified settings in parallel
      await Promise.all(
        dirtyItems.map(item => {
          const valToSend = drafts[item.id]
          return updateAdminSetting(item.id, valToSend)
        })
      )

      // Update original baseline
      setOriginalValues(drafts)
      setSettings(prev =>
        prev.map(item => (drafts[item.id] !== undefined ? { ...item, value: drafts[item.id] } : item))
      )
      showToast(`Đã lưu thành công ${dirtyCount} thay đổi cấu hình hệ thống!`)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể lưu cấu hình hệ thống.')
    } finally {
      setSavingAll(false)
    }
  }

  return (
    <div className="w-full fade-in space-y-6 pb-24">
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <SectionHeader
        eyebrow="QUẢN TRỊ HẠ TẦNG"
        title="Cài đặt hệ thống"
        subtitle="Quản lý toàn bộ cấu hình vận hành, quy tắc tính phí, chính sách bảo mật và thông báo tự động của StorageHub."
        action={
          hasChanges && (
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
                className="h-9 text-xs"
              >
                Hủy thay đổi
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={savingAll}
                onClick={handleSaveAll}
                className="h-9 gap-2 font-semibold shadow-sm text-xs"
              >
                {savingAll ? 'Đang lưu…' : `Lưu tất cả (${dirtyCount})`}
              </Button>
            </div>
          )
        }
      />

      {/* ── Category Navigation Tabs (5 Focused Categories) ─────────────── */}
      <div className="flex border-b border-stone-200">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Error alert */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={load}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Loading indicator */}
      {loading ? (
        <div role="status" className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500 shadow-sm">
          Đang tải cấu hình hệ thống…
        </div>
      ) : (
        /* ── Active Category Card (Standard Settings Row Layout) ───────── */
        <Card className="overflow-hidden border border-stone-200 shadow-sm">
          {/* Card Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 bg-[#fbfaf6] px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">{activeGroup.title}</h3>
              {activeGroup.description && (
                <p className="mt-1 text-xs text-stone-500">{activeGroup.description}</p>
              )}
            </div>

            {hasChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                {dirtyCount} thay đổi chưa lưu
              </span>
            )}
          </div>

          {/* Settings Rows Container */}
          <div className="divide-y divide-stone-100 px-6 py-2">
            {activeGroup.items.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-400">
                Chưa có thiết lập nào trong danh mục này.
              </div>
            ) : (
              activeGroup.items.map(item => {
                const currentValue = drafts[item.id] ?? item.value
                const isItemDirty = drafts[item.id] !== originalValues[item.id]

                return (
                  <div key={item.id} className="py-5 transition-colors hover:bg-[#faf9f4]/40">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Left Column (35-40%): Title & Short Description */}
                      <div className="md:col-span-5 pr-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-semibold text-stone-900">
                            {settingItemLabel(item.id, item.label)}
                          </label>
                          {isItemDirty && (
                            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Đã đổi
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed">
                          {settingItemDescription(item.id, item.description)}
                        </p>
                      </div>

                      {/* Right Column (60-65%): Form Control Appropriately Sized */}
                      <div className="md:col-span-7">
                        {item.type === 'toggle' ? (
                          <div className="space-y-1">
                            <ToggleSwitch
                              checked={Boolean(currentValue)}
                              onChange={val => handleDraftChange(item.id, val)}
                              labelActive="Đang kích hoạt"
                              labelInactive="Đã tắt"
                            />
                            <p className="text-[11px] text-stone-400">
                              {Boolean(currentValue)
                                ? 'Tính năng sẽ tự động kích hoạt khi có sự kiện phát sinh'
                                : 'Tính năng đang ở trạng thái ngưng áp dụng'}
                            </p>
                          </div>
                        ) : item.type === 'select' ? (
                          <div className="max-w-sm">
                            <select
                              value={String(currentValue)}
                              onChange={e => handleDraftChange(item.id, e.target.value)}
                              className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                            >
                              {item.options.map(option => (
                                <option key={option} value={option}>
                                  {settingOptionLabel(item.id, option)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : item.type === 'number' ? (
                          <div className="flex items-center gap-2 max-w-[260px]">
                            <input
                              type="number"
                              value={Number(currentValue)}
                              onChange={e => handleDraftChange(item.id, Number(e.target.value))}
                              className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                            />
                            <span className="text-xs font-semibold text-stone-500 shrink-0">
                              {item.id === 'gracePeriod' ? 'ngày' : item.id === 'lateFeeAmount' ? '₫ (VND)' : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="max-w-xl">
                            <input
                              type="text"
                              value={String(currentValue)}
                              onChange={e => handleDraftChange(item.id, e.target.value)}
                              placeholder="Nhập giá trị thiết lập…"
                              className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      )}

      {/* ── Sticky Save Bar (Slides up smoothly when form is dirty) ──────── */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 fade-in">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 rounded-2xl border border-stone-800 bg-[#292a27]/95 p-4 text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e9a12c] opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#e9a12c]"></span>
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Bạn có {dirtyCount} thay đổi cấu hình chưa lưu
                </p>
                <p className="text-xs text-stone-400">
                  Cấu hình mới sẽ có hiệu lực trên toàn hệ thống sau khi lưu.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
                className="border-stone-600 bg-transparent text-stone-300 hover:bg-stone-800 hover:text-white"
              >
                Hủy bỏ
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={savingAll}
                onClick={handleSaveAll}
                className="gap-2 font-semibold shadow-md"
              >
                {savingAll ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-[#3f2607]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Đang lưu cấu hình…</span>
                  </>
                ) : (
                  <span>Lưu tất cả thay đổi</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
