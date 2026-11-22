import { cccdProvinceCodes } from '../config/cccdProvinceCodes'
// Historical birthplace codes: TT 59/2021/TT-BCA, appendix I. Existing IDs retain their birthplace code.
const PROVINCES = new Set(cccdProvinceCodes)
export const normalizeCccd = (raw: string) => raw.replace(/[\s.\-]/g, '')
export function validateCccd(raw: string): { ok: boolean; error?: string; warning?: string } {
  const value = normalizeCccd(raw)
  if (!/^\d+$/.test(value)) return { ok: false, error: 'CCCD chỉ được chứa chữ số.' }
  if (value.length !== 12) return { ok: false, error: 'Vui lòng nhập CCCD 12 số.' }
  if (!PROVINCES.has(value.slice(0, 3))) return { ok: false, error: 'Mã tỉnh/thành trong CCCD không hợp lệ.' }
  const birthYear = 1900 + Math.floor(Number(value[3]) / 2) * 100 + Number(value.slice(4, 6))
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()))
  if (birthYear > year) return { ok: false, error: 'Năm sinh trong CCCD ở tương lai.' }
  if (year - birthYear < 18) return { ok: false, error: 'Người thuê phải đủ 18 tuổi.' }
  return { ok: true, warning: year - birthYear === 18 ? 'Bạn thuộc năm vừa đủ 18 tuổi. Staff cần đối chiếu ngày sinh trên giấy tờ gốc khi nhận kho.' : undefined }
}
export const maskCccd = (raw: string) => {
  const value = normalizeCccd(raw)
  return value.length > 6 ? value.slice(0, 3) + '*'.repeat(value.length - 6) + value.slice(-3) : '*'.repeat(value.length)
}
