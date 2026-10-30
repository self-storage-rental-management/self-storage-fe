import React, { useState, useEffect } from 'react'

const VIETNAM_PROVINCES_AND_CITIES = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội',
  'Hà Tĩnh', 'Hải Phòng', 'Hồ Chí Minh', 'Huế', 'Hưng Yên', 'Khánh Hòa',
  'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Nghệ An', 'Ninh Bình',
  'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
  'Thái Nguyên', 'Thanh Hóa', 'Tuyên Quang', 'Vĩnh Long',
] as const

export const WAREHOUSE_PHOTO_PRESETS: Array<{
  id: string
  title: string
  url: string
  description: string
}> = []

export interface FacilityGeneralInfoProps {
  isEditing: boolean
  code: string
  onChangeCode: (code: string) => void
  city: string
  onChangeCity: (city: string) => void
  name: string
  onChangeName: (name: string) => void
  address: string
  onChangeAddress: (addr: string) => void
  phone: string
  onChangePhone: (phone: string) => void
  existingFacilities: { id: string; code?: string }[]
  currentFacilityId?: string
  initialCode?: string
  lang?: 'vi' | 'en'
}

// Helper to remove Vietnamese tones and accents
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

// Generate acronym from Name or City
export function generateFacilityPrefix(name: string, city: string): string {
  const cleanName = removeVietnameseTones(name || '').trim()
  if (cleanName) {
    const words = cleanName.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    if (words.length > 0) {
      const acronym = words.map((w, idx) => {
        if (/^\d+$/.test(w)) return w
        if (/^[a-zA-Z]+\d+$/.test(w)) return w.toUpperCase()
        const nextWord = words[idx + 1]
        if (nextWord && /^\d+$/.test(nextWord)) {
          return w[0].toUpperCase()
        }
        return w[0].toUpperCase()
      }).join('')

      if (acronym.length >= 2) return acronym
      if (acronym.length === 1 && cleanName.length >= 2) {
        return cleanName.slice(0, 3).toUpperCase()
      }
    }
  }

  // Fallback to City acronym nếu Tên cơ sở chưa nhập
  const cleanCity = removeVietnameseTones(city || '').trim()
  if (cleanCity) {
    const cityMap: Record<string, string> = {
      'ho chi minh': 'HCM',
      'ha noi': 'HN',
      'da nang': 'DN',
      'binh duong': 'BD',
      'can tho': 'CT',
      'hai phong': 'HP',
      'dong nai': 'DNA',
      'bac ninh': 'BN',
      'khanh hoa': 'KH',
      'lam dong': 'LD',
      'quang ninh': 'QN',
      'ba ria vung tau': 'BRVT',
      'vung tau': 'VT',
      'thua thien hue': 'HUE',
      'hue': 'HUE',
      'long an': 'LA',
      'tien giang': 'TG',
      'an giang': 'AG',
      'kien giang': 'KG',
    }
    const lowerCity = cleanCity.toLowerCase()
    if (cityMap[lowerCity]) return cityMap[lowerCity]
    const words = cleanCity.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    return words.map(w => w[0].toUpperCase()).join('')
  }

  return 'FAC'
}

// Function to generate the next unique code
export function generateFacilityCode(
  name: string,
  city: string,
  existingFacilities: { id: string; code?: string }[],
  currentFacilityId?: string,
): string {
  const prefix = generateFacilityPrefix(name, city)
  const existingCodes = new Set(
    (existingFacilities || [])
      .filter(f => !currentFacilityId || f.id !== currentFacilityId)
      .map(f => (f.code || f.id || '').trim().toUpperCase())
  )

  let index = 1
  let candidate = `${prefix}-F${String(index).padStart(2, '0')}`
  while (existingCodes.has(candidate)) {
    index++
    candidate = `${prefix}-F${String(index).padStart(2, '0')}`
  }
  return candidate
}

export const FacilityGeneralInfo: React.FC<FacilityGeneralInfoProps> = ({
  isEditing,
  code,
  onChangeCode,
  city,
  onChangeCity,
  name,
  onChangeName,
  address,
  onChangeAddress,
  phone,
  onChangePhone,
  existingFacilities,
  currentFacilityId,
  initialCode,
  lang = 'vi',
}) => {
  const [isCityListOpen, setIsCityListOpen] = useState(false)
  const [isAutoCode, setIsAutoCode] = useState(!isEditing)

  // Tự động cập nhật mã khi ở chế độ tạo mới và đang bật Auto
  useEffect(() => {
    if (!isEditing && isAutoCode) {
      if (name.trim() || city.trim()) {
        const nextCode = generateFacilityCode(name, city, existingFacilities, currentFacilityId)
        if (nextCode && nextCode !== code) {
          onChangeCode(nextCode)
        }
      }
    }
  }, [name, city, isAutoCode, isEditing, existingFacilities, currentFacilityId])

  const toggleAutoCode = () => {
    if (isAutoCode) {
      setIsAutoCode(false)
    } else {
      setIsAutoCode(true)
      const nextCode = generateFacilityCode(name, city, existingFacilities, currentFacilityId)
      onChangeCode(nextCode)
    }
  }

  const handleNameChange = (val: string) => {
    onChangeName(val)
    if (isAutoCode && !isEditing) {
      const nextCode = generateFacilityCode(val, city, existingFacilities, currentFacilityId)
      onChangeCode(nextCode)
    }
  }

  const handleCityChange = (val: string) => {
    onChangeCity(val)
    if (isAutoCode && !isEditing) {
      const nextCode = generateFacilityCode(name, val, existingFacilities, currentFacilityId)
      onChangeCode(nextCode)
    }
  }

  // Validate duplicate code
  const isDuplicate = existingFacilities.some(
    (f) =>
      (f.code || f.id).toUpperCase() === code.trim().toUpperCase() &&
      (!isEditing || f.id !== currentFacilityId)
  )

  // Validate Vietnamese phone number
  const isPhoneValid = !phone.trim() || /^(0[35789]\d{8}|(024|028)\d{8}|(1900|1800)\d{4,6})$/.test(phone.replace(/\s+/g, ''))

  // Check code modified warning in Edit mode
  const isCodeModified = isEditing && initialCode && code.trim().toUpperCase() !== initialCode.trim().toUpperCase()

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
        {lang === 'vi' ? 'Thông tin cơ sở' : 'Facility Information'}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Mã cơ sở */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-stone-700">
                {lang === 'vi' ? 'Mã cơ sở *' : 'Facility Code *'}
              </label>
              {isAutoCode && !isEditing && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {lang === 'vi' ? 'Tự động tạo' : 'Auto-generated'}
                </span>
              )}
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={toggleAutoCode}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                title={isAutoCode ? (lang === 'vi' ? 'Mở khóa để sửa mã thủ công' : 'Unlock to edit manually') : (lang === 'vi' ? 'Khóa để tự động sinh mã' : 'Lock to auto-generate')}
              >
                {isAutoCode ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-stone-500 hover:text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>{lang === 'vi' ? 'Sửa tay' : 'Custom'}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-emerald-700 font-semibold">{lang === 'vi' ? 'Tự động' : 'Auto'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          <input
            type="text"
            readOnly={isAutoCode || isEditing}
            className={`w-full border rounded-lg px-3 py-2 text-sm font-bold uppercase focus:outline-none focus:ring-1 ${
              isAutoCode || isEditing
                ? 'border-stone-300 bg-stone-100/80 text-stone-700 cursor-not-allowed select-all'
                : isDuplicate || !code.trim()
                  ? 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                  : 'border-stone-300 bg-white text-stone-900 focus:ring-amber-500'
            }`}
            placeholder={isAutoCode ? (lang === 'vi' ? 'Tự động điền theo Tên/Tỉnh...' : 'Auto-filled...') : 'VD: HCM-Q1-F01'}
            value={code}
            onChange={(e) => onChangeCode(e.target.value.toUpperCase())}
          />
          {isDuplicate ? (
            <p className="text-[10px] font-semibold text-red-600 mt-1">
              Mã cơ sở &quot;{code.trim().toUpperCase()}&quot; đã tồn tại! Vui lòng chọn mã khác.
            </p>
          ) : isCodeModified ? (
            <p className="text-[10px] font-semibold text-amber-700 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Mã cơ sở thay đổi có thể ảnh hưởng đến mã gian kho dạng MãCơSở-Size-001.</span>
            </p>
          ) : null}
        </div>

        {/* Tỉnh / Thành phố */}
        <div className="relative">
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Tỉnh / Thành phố *' : 'City / Province *'}
          </label>
          <div className="relative">
            <input
              type="text"
              className="w-full border border-stone-300 rounded-lg pl-3 pr-10 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              onFocus={() => setIsCityListOpen(true)}
              onBlur={() => setIsCityListOpen(false)}
              placeholder={lang === 'vi' ? 'Nhập hoặc chọn tỉnh/thành phố' : 'Enter or select a city/province'}
              role="combobox"
              aria-expanded={isCityListOpen}
              aria-controls="vietnam-provinces-and-cities"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-stone-600 hover:text-amber-700"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsCityListOpen((open) => !open)}
              aria-label={lang === 'vi' ? 'Mở danh sách tỉnh thành' : 'Open city and province list'}
            >
              <svg className={`w-4 h-4 transition-transform ${isCityListOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {isCityListOpen && (
            <div
              id="vietnam-provinces-and-cities"
              role="listbox"
              className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-xl"
            >
              {VIETNAM_PROVINCES_AND_CITIES.map((province) => (
                <button
                  key={province}
                  type="button"
                  role="option"
                  aria-selected={city === province}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 ${city === province ? 'bg-amber-50 font-semibold text-amber-900' : 'text-stone-800'}`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleCityChange(province)
                    setIsCityListOpen(false)
                  }}
                >
                  {province}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tên cơ sở */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">
          {lang === 'vi' ? 'Tên cơ sở *' : 'Facility Name *'}
        </label>
        <input
          type="text"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
          placeholder="VD: Kho Tân Bình..."
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      {/* Địa chỉ chi tiết */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">
          {lang === 'vi' ? 'Địa điểm / Địa chỉ chi tiết *' : 'Street Address *'}
        </label>
        <input
          type="text"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="VD: Số 123 Đường Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy..."
          value={address}
          onChange={(e) => onChangeAddress(e.target.value)}
        />
      </div>

      {/* Hotline. Manager is assigned by Admin through the account facility scope. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Hotline liên hệ' : 'Phone / Hotline'}
          </label>
          <input
            type="text"
            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 ${
              !isPhoneValid
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                : 'border-stone-300 text-stone-900 focus:ring-amber-500'
            }`}
            placeholder="VD: 024 3822 9999 hoặc 1900 6868..."
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
          />
          {!isPhoneValid && (
            <p className="text-[10px] font-semibold text-red-600 mt-1">
              Số điện thoại không đúng định dạng VN (10 chữ số bắt đầu bằng 0, hoặc đầu số 1900/1800)
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export interface FacilityOperationsProps {
  accessHours: string
  onChangeAccessHours: (hours: string) => void
  status: 'setup' | 'active' | 'maintenance' | 'inactive'
  onChangeStatus: (status: 'setup' | 'active' | 'maintenance' | 'inactive') => void
  statusReadOnly?: boolean
  initialStatus?: 'setup' | 'active' | 'maintenance' | 'inactive'
  lang?: 'vi' | 'en'
}

export const FacilityOperations: React.FC<FacilityOperationsProps> = ({
  accessHours,
  onChangeAccessHours,
  status,
  onChangeStatus,
  statusReadOnly = false,
  initialStatus,
  lang = 'vi',
}) => {
  return (
    <div className="pt-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
        {lang === 'vi' ? 'Thông số vận hành' : 'Operation Settings'}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
        {/* Khung giờ mở cửa */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Khung giờ mở cửa' : 'Opening Hours'}
          </label>

          {/* Ô nhập trực tiếp giờ hoạt động */}
          <input
            type="text"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="08:00 - 17:00"
            value={accessHours}
            onChange={(e) => onChangeAccessHours(e.target.value)}
          />
        </div>

        {/* Trạng thái hoạt động (chỉ dùng Tiếng Việt) */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Trạng thái hoạt động' : 'Initial Status'}
          </label>
          <select
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={status}
            disabled={statusReadOnly}
            onChange={(e) => onChangeStatus(e.target.value as FacilityOperationsProps['status'])}
          >
            <option value="setup">Đang thiết lập - chưa có loại kho/giá</option>
            <option value="active">Đang hoạt động</option>
            <option value="maintenance">Bảo trì</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
          <p className="text-[10px] text-stone-500 mt-1">
            {status === 'setup' ? '● Cơ sở mới tạo, chưa được công bố cho Customer'
              : status === 'active' ? '● Cơ sở đã công bố và sẵn sàng nhận khách'
                : status === 'maintenance' ? '▲ Cơ sở đang tạm dừng vận hành / bảo dưỡng'
                  : '● Cơ sở đã ngừng hoạt động'}
          </p>
          {status === 'active' && initialStatus === 'active' ? (
            <div className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50/90 p-2.5 text-xs text-emerald-950 flex items-center gap-2 shadow-2xs">
              <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold text-emerald-900">
                {lang === 'vi' ? 'Cơ sở đã kích hoạt thành công và đang hiển thị công khai cho khách hàng.' : 'Facility is active and visible to customers.'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export interface FacilityImageManagerProps {
  image: string
  onChangeImage: (img: string) => void
  lang?: 'vi' | 'en'
}

export const FacilityImageManager: React.FC<FacilityImageManagerProps> = ({
  image,
  onChangeImage,
  lang = 'vi',
}) => {
  const [loadError, setLoadError] = useState<boolean>(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh vượt quá giới hạn 5MB!')
      return
    }

    const reader = new FileReader()
    reader.onload = (uploadEvt) => {
      const result = uploadEvt.target?.result
      if (typeof result === 'string') {
        // Nén ảnh đơn giản qua Canvas trước khi lưu
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1200
          let w = img.width
          let h = img.height
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h)
            const compressed = canvas.toDataURL('image/jpeg', 0.85)
            onChangeImage(compressed)
            setLoadError(false)
          } else {
            onChangeImage(result)
            setLoadError(false)
          }
        }
        img.src = result
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    onChangeImage('')
    setLoadError(false)
  }

  const hasValidImage = Boolean(image && image.trim() && !loadError)

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          {lang === 'vi' ? 'Hình ảnh cơ sở & kho bãi' : 'Facility Photos'}
        </h4>
        <span className="text-[11px] text-stone-400">
          {lang === 'vi' ? 'Đồng bộ hiển thị lên thẻ kho khách hàng' : 'Synced with customer warehouse card'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start bg-stone-50 p-3 rounded-xl border border-stone-200">
        <div className="relative w-full sm:w-44 h-32 rounded-lg overflow-hidden bg-stone-100 border border-stone-300 shrink-0 group shadow-xs">
          {hasValidImage ? (
            <>
              <img
                src={image}
                alt="Facility preview"
                className="w-full h-full object-cover transition duration-200"
                onError={() => setLoadError(true)}
              />
              <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label
                  className="cursor-pointer bg-white text-stone-800 text-[11px] font-bold px-2 py-1.5 rounded-lg shadow-sm hover:bg-stone-100 flex items-center gap-1 transition"
                  aria-label="Đổi hình ảnh"
                >
                  <svg className="w-3.5 h-3.5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Đổi ảnh</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold p-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  title="Gỡ ảnh này"
                  aria-label="Gỡ ảnh"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-stone-400 bg-stone-100/80">
              <svg className="w-8 h-8 mb-1 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] font-medium text-stone-500">Chưa có ảnh cơ sở</span>
              <span className="text-[9px] text-stone-400 mt-0.5">Tải lên hoặc dán URL</span>
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-2 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
              {lang === 'vi' ? 'Tải ảnh từ máy tính hoặc dán link ảnh (URL)' : 'Upload or paste image URL'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="https://... hoặc chọn file từ máy tính"
                value={image}
                onChange={(e) => {
                  onChangeImage(e.target.value)
                  setLoadError(false)
                }}
              />
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold rounded-lg text-xs shrink-0 transition shadow-2xs">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>{lang === 'vi' ? 'Chọn file' : 'Upload'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              {image ? (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-2.5 py-1.5 bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 border border-stone-200 hover:border-red-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  title="Xóa ảnh"
                >
                  {lang === 'vi' ? 'Xóa' : 'Clear'}
                </button>
              ) : null}
            </div>
            {loadError && (
              <p className="text-[10px] text-red-600 mt-1 font-semibold">
                Không thể tải hình ảnh từ URL này. Vui lòng kiểm tra lại link hoặc tải file từ máy tính.
              </p>
            )}
            <p className="text-[11px] text-stone-500 mt-1.5">
              Hỗ trợ các định dạng JPG, PNG, WebP (tối đa 5MB). Hình ảnh sẽ tự động hiển thị trên thẻ kho dành cho khách thuê.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
