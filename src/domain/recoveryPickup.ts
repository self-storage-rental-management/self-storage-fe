import { parseVietnamDate, vietnamDateTimeInput } from '../utils/vietnamTime'

export function recoveryPickupBounds(deadline: string | null | undefined, now = Date.now()) {
  const end = deadline ? Date.parse(deadline) : NaN
  const firstMinute = Math.ceil(now / 60_000) * 60_000
  const lastMinute = Math.floor(end / 60_000) * 60_000
  return {
    min: vietnamDateTimeInput(firstMinute),
    max: Number.isFinite(end) ? vietnamDateTimeInput(lastMinute) : '',
    available: Number.isFinite(end) && now < end && firstMinute <= lastMinute,
  }
}

export function recoveryPickupError(appointment: string, deadline: string | null | undefined, now = Date.now()): string | null {
  const bounds = recoveryPickupBounds(deadline, now)
  if (!bounds.max) return 'Chưa có hạn nhận hàng lưu tạm. Vui lòng liên hệ cơ sở.'
  if (!bounds.available) return 'Đã hết thời gian đặt lịch nhận hàng. Vui lòng liên hệ cơ sở để được hỗ trợ.'
  if (!appointment) return 'Vui lòng chọn ngày và giờ nhận hàng.'
  const chosen = parseVietnamDate(appointment).getTime()
  if (!Number.isFinite(chosen)) return 'Ngày giờ nhận hàng không hợp lệ.'
  if (chosen < now) return 'Không thể chọn ngày giờ nhận hàng trong quá khứ.'
  if (chosen > Date.parse(deadline!)) return 'Ngày giờ đã chọn vượt quá hạn nhận hàng lưu tạm.'
  return null
}
