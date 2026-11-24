import { useState } from 'react'
import type { User } from '../../types'
import { contactErrors } from '../../components/CustomerProfileFields'
import { isVietnamesePhone } from '../../domain/vietnamesePhone'
import { maskCccd } from '../../domain/cccd'
import { normalizeRentalIdentity, validateRentalIdentity } from '../../domain/rentalIdentity'

interface Props {
  user: User
  identity: string
  phone: string
  address: string
  identityFromProfile: boolean
  onIdentityChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onAddressChange: (value: string) => void
  onOpenProfile: () => void
}

export default function BookingPersonalDetails({ user, identity, phone, address, identityFromProfile, onIdentityChange, onPhoneChange, onAddressChange, onOpenProfile }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [visible, setVisible] = useState(false)
  const locked = !!user.profileDetails?.identityVerifiedAt
  const first = contactErrors({ ...user, phone })
  const second = contactErrors({ ...user, phone }, true)
  const checks = [
    { label: 'Số điện thoại', ok: isVietnamesePhone(phone), id: 'booking-contact-phone' },
    { label: 'Giấy tờ tùy thân', ok: !!identity && validateRentalIdentity(identity).ok, id: 'booking-identity-number' },
    { label: 'Người liên hệ khẩn cấp', ok: !Object.keys(first).some(key => key !== 'consent') && !Object.keys(second).some(key => key !== 'consent') },
    { label: 'Đồng ý thông báo cho người liên hệ', ok: !first.consent && !second.consent },
  ]
  const completed = checks.filter(item => item.ok).length
  const input = 'w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20'
  const badge = 'ml-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-600'
  const label = 'mb-1.5 block text-sm font-medium text-stone-700'
  const jump = (id?: string) => {
    if (!id) { onOpenProfile(); return }
    if (id === 'booking-identity-number' && !locked) setEditing(true)
    document.getElementById(id)?.focus()
  }
  return <section className="space-y-5" aria-label="Thông tin cá nhân người thuê">
    <div className="rounded-xl bg-stone-100 p-4">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-stone-800"><h3>Hoàn thiện hồ sơ</h3><div className="flex items-center gap-3"><span>{completed}/4 mục</span><button type="button" className="text-xs font-normal underline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu gọn' : 'Mở rộng'}</button></div></div>
      <progress className="mt-2 h-2 w-full accent-blue-600" value={completed} max={4} aria-label="Thông tin cần bổ sung trước thanh toán cọc" />
      {expanded && <><ul className="mt-3 space-y-2 text-sm">{checks.map(item => <li key={item.label}>
        <button type="button" onClick={() => jump(item.id)} className={`flex items-center gap-2 text-left ${item.ok ? 'text-emerald-700' : 'text-red-700 underline decoration-dotted underline-offset-4'}`}>
          <span aria-hidden="true">{item.ok ? '✓' : '⊗'}</span>{item.label}
        </button>
      </li>)}</ul>
      <p className="mt-3 text-xs leading-5 text-stone-500">Họ tên và email đã lấy từ hồ sơ. Các mục trên cần đủ trước khi thanh toán cọc, không chặn việc đặt giữ kho. Hồ sơ cần có địa chỉ trước khi thanh toán và ký hợp đồng.</p></>}
    </div>
    <div>
      <label className={label} htmlFor="booking-renter-name">Họ và tên người thuê<span className={badge}>Lấy từ hồ sơ</span></label>
      <input id="booking-renter-name" className={`${input} bg-stone-50`} value={user.name} readOnly />
      <p className="mt-1.5 text-xs text-stone-500">Nhập họ tên như trên CCCD hoặc hộ chiếu. Sửa họ tên tại Hồ sơ.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className={label} htmlFor="booking-login-email">Email<span className={badge}>Dùng để đăng nhập</span></label><input id="booking-login-email" className={`${input} bg-stone-50`} value={user.email} readOnly /></div>
      <div><label className={label} htmlFor="booking-contact-phone">Số điện thoại</label><input id="booking-contact-phone" className={input} type="tel" value={phone} onChange={event => onPhoneChange(event.target.value)} placeholder="0901234567" />{phone && !isVietnamesePhone(phone) && <p role="alert" className="mt-1 text-xs text-red-700">Số điện thoại Việt Nam không hợp lệ.</p>}</div>
    </div>
    <div>
      <label className={label} htmlFor="booking-identity-number">Giấy tờ tùy thân của người thuê<span className={badge}>Cần trước thanh toán cọc</span></label>
      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
        <input id="booking-identity-number" className={`${input} flex-1`} value={!identity || editing || visible ? identity : maskCccd(identity)} placeholder="Số CCCD hoặc hộ chiếu" autoComplete="off"
          readOnly={locked || (!!identity && !editing)} aria-describedby="booking-identity-hint"
          onChange={event => { setEditing(true); onIdentityChange(normalizeRentalIdentity(event.target.value)) }}
          onBlur={() => { setEditing(false); setVisible(false) }} />
        {!!identity && <button type="button" className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm" onClick={() => setVisible(!visible)}>{visible ? 'Ẩn' : 'Xem'}</button>}
        {!!identity && !locked && <button type="button" className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm" onClick={() => { setEditing(true); document.getElementById('booking-identity-number')?.focus() }}>Sửa</button>}
      </div>
      <p id="booking-identity-hint" className="mt-1.5 text-xs text-stone-500">Mang giấy tờ gốc để đối chiếu khi nhận kho và kiểm kê.{identityFromProfile && identity ? ' Lấy từ hồ sơ.' : ''}{locked ? ' Đã đối chiếu. Liên hệ Staff nếu cần sửa.' : ''}</p>
      {!!identity && !validateRentalIdentity(identity).ok && <p role="alert" className="mt-1 text-xs text-red-700">{validateRentalIdentity(identity).error}</p>}
    </div>
    <div><label className={label} htmlFor="booking-customer-address">Địa chỉ<span className={badge}>Không bắt buộc khi đặt giữ kho</span></label><input id="booking-customer-address" className={input} value={address} onChange={event => onAddressChange(event.target.value)} /></div>
    <p className="text-xs leading-5 text-stone-500">Sau khi tạo đơn, số điện thoại, CCCD và địa chỉ đã nhập sẽ được cập nhật vào hồ sơ. Các đơn cũ vẫn giữ nguyên dữ liệu đã chụp.</p>
  </section>
}
