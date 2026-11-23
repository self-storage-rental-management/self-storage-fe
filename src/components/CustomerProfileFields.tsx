import { useState } from 'react'
import { isVietnamesePhone } from '../domain/vietnamesePhone'
import { maskCccd } from '../domain/cccd'
import { normalizeRentalIdentity, validateRentalIdentity } from '../domain/rentalIdentity'
import type { CustomerProfileDetails, User } from '../types'

type Profile = Pick<User, 'name' | 'phone' | 'permanentAddress' | 'emergencyContactName' | 'emergencyContactPhone' | 'profileDetails'>
const phoneKey = (s?: string) => (s || '').replace(/[^+0-9]/g, '').replace(/^\+?84/, '0')
export function contactErrors(user: Profile, second = false) {
  const d = user.profileDetails || {}
  const name = second ? d.secondaryEmergencyContactName : user.emergencyContactName
  const phone = second ? d.secondaryEmergencyContactPhone : user.emergencyContactPhone
  const relation = second ? d.secondaryEmergencyContactRelationship : d.emergencyContactRelationship
  const email = second ? d.secondaryEmergencyContactEmail : d.emergencyContactEmail
  const consent = second ? d.secondaryEmergencyContactConsent : d.emergencyContactConsent
  const present = !!(name || phone || relation || email || consent)
  const errors: Record<string, string> = {}
  if (!present && second) return errors
  if (!name || name.trim().length < 2) errors.name = 'Nhập họ tên người liên hệ (ít nhất 2 ký tự).'
  if (!phone || !isVietnamesePhone(phone)) errors.phone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  else if (phoneKey(phone) === phoneKey(user.phone)) errors.phone = 'Số này trùng với SĐT của bạn.'
  else if (second && phoneKey(phone) === phoneKey(user.emergencyContactPhone)) errors.phone = 'Số này trùng với người liên hệ thứ nhất.'
  if (!relation) errors.relationship = 'Vui lòng chọn quan hệ.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ.'
  if (!consent) errors.consent = 'Bắt buộc xác nhận người này đã đồng ý cung cấp thông tin.'
  return errors
}
export function validateEmergencyProfile(user: Profile): string | null {
  const d = user.profileDetails || {}
  if (d.identityDocumentNumber) {
    const result = validateRentalIdentity(d.identityDocumentNumber)
    if (!result.ok) return result.error!
  }
  const primaryPresent = !!(user.emergencyContactName || user.emergencyContactPhone || d.emergencyContactRelationship || d.emergencyContactEmail || d.emergencyContactConsent)
  const first = primaryPresent ? Object.values(contactErrors(user)) : []
  return first[0] || Object.values(contactErrors(user, true))[0] || null
}
function checklist(user: Profile) {
  const d = user.profileDetails || {}
  const first = contactErrors(user)
  const second = contactErrors(user, true)
  return [
    { label: 'Số điện thoại', id: 'profile-phone', ok: isVietnamesePhone(user.phone || '') },
    { label: 'Địa chỉ', id: 'profile-address', ok: (user.permanentAddress || '').trim().length >= 5 },
    { label: 'Giấy tờ tùy thân', id: 'profile-identity', ok: !!d.identityDocumentNumber && validateRentalIdentity(d.identityDocumentNumber).ok },
    { label: 'Người liên hệ khẩn cấp', id: 'profile-contact-1', ok: !Object.keys(first).some(k => k !== 'consent') && !Object.keys(second).some(k => k !== 'consent') },
    { label: 'Đồng ý cung cấp thông tin NLHKC', id: !d.emergencyContactConsent ? 'profile-contact-1-consent' : 'profile-contact-2-consent', ok: !first.consent && !second.consent },
  ]
}
export const profileProgress = (user: Profile) => checklist(user).filter(item => item.ok).length
export function CustomerProfileReminder({ user, onOpen, title = 'Hoàn thiện hồ sơ' }: { user: User; onOpen?: () => void; title?: string }) {
  const items = checklist(user)
  const count = items.filter(item => item.ok).length
  if (count === 5) return <p className="text-sm text-emerald-700" role="status">✓ Hồ sơ đã hoàn thiện</p>
  const jump = (id: string) => {
    onOpen?.()
    window.setTimeout(() => {
      const target = document.getElementById(id)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const control = target?.matches('input,textarea,select') ? target : target?.querySelector<HTMLElement>('input,textarea,select')
      ;(control as HTMLElement | null)?.focus()
    }, 100)
  }
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-stone-800">
    <p className="font-semibold">{title}: {count}/5</p>
    <progress className="mt-2 w-full accent-amber-600" value={count} max={5} aria-label="Tiến độ hoàn thiện hồ sơ" />
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{items.map(item => <li key={item.label}>{item.ok ? <span className="text-emerald-800">✓ {item.label}</span> : <button type="button" className="text-amber-900 underline" onClick={() => jump(item.id)}>○ Bổ sung {item.label.toLowerCase()}</button>}</li>)}</ul>
    {count < 5 && <p className="mt-2">Bạn vẫn có thể xem kho và đặt giữ kho. Hoàn thiện hồ sơ trước khi thanh toán cọc, ký hợp đồng và nhận kho.</p>}
  </div>
}
export function CustomerProfileFields({ value, onChange, user, onNameChange, onPhoneChange }: {
  value: CustomerProfileDetails; onChange: (value: CustomerProfileDetails) => void; user: User
  onNameChange: (value: string) => void; onPhoneChange: (value: string) => void
}) {
  const [showIdentity, setShowIdentity] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityTouched, setIdentityTouched] = useState(false)
  const set = (key: keyof CustomerProfileDetails, next: string | boolean) => onChange({ ...value, [key]: next })
  const input = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm'
  const identity = value.identityDocumentNumber || ''
  const result = identity ? validateRentalIdentity(identity) : null
  const locked = !!value.identityVerifiedAt
  const errorLine = (error?: string) => error && <p className="text-xs text-red-700" role="alert">{error}</p>
  return <div className="space-y-5">
    <fieldset id="profile-identity" className="space-y-3 rounded-xl border border-stone-200 p-4">
      <legend className="px-1 font-semibold">Danh tính</legend>
      <label htmlFor="profile-cccd" className="block text-sm font-medium">Số CCCD hoặc hộ chiếu</label>
      <div className="flex gap-2"><input id="profile-cccd" className={input} autoComplete="off" readOnly={locked || (!!identity && !editingIdentity)}
        value={editingIdentity || showIdentity || !identity ? identity : maskCccd(identity)}
        aria-invalid={identityTouched && !!result && !result.ok} aria-describedby="profile-cccd-feedback"
        onChange={e => { setEditingIdentity(true); setIdentityTouched(true); set('identityDocumentNumber', normalizeRentalIdentity(e.target.value)) }}
        onBlur={() => { setIdentityTouched(true); setEditingIdentity(false); setShowIdentity(false) }} />
        {!!identity && <button type="button" className="shrink-0 text-sm underline" onClick={() => setShowIdentity(!showIdentity)}>{showIdentity ? 'Ẩn' : 'Xem'}</button>}
        {!locked && <button type="button" className="shrink-0 text-sm underline" onClick={() => { setEditingIdentity(true); setShowIdentity(true); document.getElementById('profile-cccd')?.focus() }}>Sửa</button>}
      </div>
      <div id="profile-cccd-feedback">{identityTouched && errorLine(result?.error)}{result?.warning && <p className="text-xs text-amber-800">{result.warning}</p>}</div>
      {locked && <p className="text-xs text-stone-600">Staff đã đối chiếu giấy tờ gốc. Vui lòng liên hệ Staff nếu cần sửa.</p>}
    </fieldset>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{[false, true].map(second => {
      const index = second ? 2 : 1
      const errors = contactErrors({ ...user, profileDetails: value }, second)
      const contactPhone = (second ? value.secondaryEmergencyContactPhone : user.emergencyContactPhone) || ''
      const id = `profile-contact-${index}`
      return <fieldset key={id} id={id} className="space-y-3 rounded-xl border border-stone-200 p-4">
        <legend className="px-1 font-semibold">Người liên hệ khẩn cấp {index}{second ? ' (không bắt buộc)' : ' *'}</legend>
        <label className="block text-sm">Họ và tên<input className={input} maxLength={160} value={(second ? value.secondaryEmergencyContactName : user.emergencyContactName) || ''} onChange={e => second ? set('secondaryEmergencyContactName', e.target.value) : onNameChange(e.target.value)} /></label>
        <label className="block text-sm">Số điện thoại<input className={input} type="tel" maxLength={30} value={contactPhone} aria-invalid={!!contactPhone && !!errors.phone} onChange={e => second ? set('secondaryEmergencyContactPhone', e.target.value) : onPhoneChange(e.target.value)} /></label>
        {!!contactPhone && errorLine(errors.phone)}
        <label className="block text-sm">Quan hệ<select className={input} value={(second ? value.secondaryEmergencyContactRelationship : value.emergencyContactRelationship) || ''} onChange={e => set(second ? 'secondaryEmergencyContactRelationship' : 'emergencyContactRelationship', e.target.value)}>
          <option value="" disabled>Chọn quan hệ</option>{['Cha/mẹ', 'Vợ/chồng', 'Anh/chị/em', 'Con', 'Đồng nghiệp', 'Bạn bè', 'Khác'].map(relation => <option key={relation}>{relation}</option>)}
        </select></label>
        <label className="block text-sm">Email (không bắt buộc)<input className={input} type="email" maxLength={320} value={(second ? value.secondaryEmergencyContactEmail : value.emergencyContactEmail) || ''} onChange={e => set(second ? 'secondaryEmergencyContactEmail' : 'emergencyContactEmail', e.target.value)} /></label>
        <label className="flex gap-2 text-sm"><input id={`${id}-consent`} type="checkbox" checked={!!(second ? value.secondaryEmergencyContactConsent : value.emergencyContactConsent)} onChange={e => set(second ? 'secondaryEmergencyContactConsent' : 'emergencyContactConsent', e.target.checked)} />Tôi xác nhận người này đã đồng ý cung cấp thông tin liên hệ {second ? '(bắt buộc nếu thêm người thứ hai)' : '*'}</label>
        {second && <button type="button" className="text-xs underline" onClick={() => onChange({ ...value, secondaryEmergencyContactName: '', secondaryEmergencyContactPhone: '', secondaryEmergencyContactRelationship: '', secondaryEmergencyContactEmail: '', secondaryEmergencyContactConsent: false })}>Xóa người liên hệ thứ hai</button>}
      </fieldset>
    })}</div>
  </div>
}
