import React, { useState, useEffect } from 'react'
import { Select } from '../../../components/ui'

export const WAREHOUSE_PHOTO_PRESETS = [
  {
    id: 'preset-std',
    title: 'Kho tiêu chuẩn hiện đại',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
    description: 'Hệ thống kệ thép công nghiệp, lối xe rộng',
  },
  {
    id: 'preset-logistics',
    title: 'Kho Logistics & Pallet',
    url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&auto=format&fit=crop&q=80',
    description: 'Khu vực bốc xếp pallet, sàn chịu tải trọng cao',
  },
  {
    id: 'preset-smart',
    title: 'Kho tự quản thông minh 24/7',
    url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=800&auto=format&fit=crop&q=80',
    description: 'Khóa số điện tử, điều hòa nhiệt ẩm tự động',
  },
  {
    id: 'preset-mini',
    title: 'Kho mini cá nhân & gia đình',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    description: 'Ngăn kho nhỏ gọn, bảo quản đồ dùng gia đình',
  },
]

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
  manager: string
  onChangeManager: (mgr: string) => void
  phone: string
  onChangePhone: (phone: string) => void
  existingFacilities: { id: string; code?: string }[]
  currentFacilityId?: string
  initialCode?: string
  onResetCode?: () => void
  isAutoCode?: boolean
  lang?: 'vi' | 'en'
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
  manager,
  onChangeManager,
  phone,
  onChangePhone,
  existingFacilities,
  currentFacilityId,
  initialCode,
  onResetCode,
  isAutoCode = false,
  lang = 'vi',
}) => {
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
            <label className="text-xs font-semibold text-stone-700">
              {lang === 'vi' ? 'Mã cơ sở / Mã kho *' : 'Facility Code *'}
            </label>
            <div className="flex items-center gap-1.5">
              {!isEditing && isAutoCode && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Tự động
                </span>
              )}
              {onResetCode && (
                <button
                  type="button"
                  onClick={onResetCode}
                  className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold underline cursor-pointer"
                  title="Gợi ý lại mã cơ sở chuẩn theo Tỉnh/TP"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            className={`w-full border rounded-lg px-3 py-2 text-sm font-bold uppercase bg-white focus:outline-none focus:ring-1 ${
              isDuplicate || !code.trim()
                ? 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                : 'border-stone-300 text-stone-900 focus:ring-amber-500'
            }`}
            placeholder="VD: HN-F02"
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
          ) : (
            <p className="text-[11px] text-stone-400 mt-0.5">
              Quy chuẩn: Tỉnh/TP - Số thứ tự (VD: HN-F02)
            </p>
          )}
        </div>

        {/* Tỉnh / Thành phố */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Tỉnh / Thành phố *' : 'City / Province *'}
          </label>
          <Select
            value={city}
            onChange={(e) => onChangeCity(e.target.value)}
          >
            <option value="Hà Nội">Hà Nội</option>
            <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
            <option value="Bình Dương">Bình Dương</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
            <option value="Cần Thơ">Cần Thơ</option>
            <option value="Hải Phòng">Hải Phòng</option>
            <option value="Đồng Nai">Đồng Nai</option>
            <option value="Vũng Tàu">Vũng Tàu</option>
            <option value="Nha Trang">Nha Trang</option>
          </Select>
        </div>
      </div>

      {/* Tên cơ sở */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1">
          {lang === 'vi' ? 'Tên cơ sở / Chi nhánh kho *' : 'Facility Name *'}
        </label>
        <input
          type="text"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
          placeholder="VD: Kho Việt – Cơ sở Hà Nội..."
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
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

      {/* Quản lý & Hotline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Người quản lý chi nhánh' : 'Facility Manager'}
          </label>
          <input
            type="text"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="VD: Trần Văn Quản Lý..."
            value={manager}
            onChange={(e) => onChangeManager(e.target.value)}
          />
        </div>

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
  status: 'active' | 'maintenance'
  onChangeStatus: (status: 'active' | 'maintenance') => void
  lang?: 'vi' | 'en'
}

export const FacilityOperations: React.FC<FacilityOperationsProps> = ({
  accessHours,
  onChangeAccessHours,
  status,
  onChangeStatus,
  lang = 'vi',
}) => {
  const is24_7 = accessHours.includes('24/7')

  // Giờ mở và đóng cửa trích xuất nếu có dạng HH:MM - HH:MM
  const timeMatch = accessHours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/)
  const [openTime, setOpenTime] = useState<string>(timeMatch ? timeMatch[1] : '06:00')
  const [closeTime, setCloseTime] = useState<string>(timeMatch ? timeMatch[2] : '22:00')

  useEffect(() => {
    if (timeMatch) {
      setOpenTime(timeMatch[1])
      setCloseTime(timeMatch[2])
    }
  }, [accessHours])

  const handleTimeChange = (newOpen: string, newClose: string) => {
    setOpenTime(newOpen)
    setCloseTime(newClose)
    onChangeAccessHours(`${newOpen} - ${newClose} hàng ngày`)
  }

  return (
    <div className="pt-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
        {lang === 'vi' ? 'Thông số vận hành' : 'Operation Settings'}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Khung giờ ra vào / Giờ mở cửa */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-stone-700">
            {lang === 'vi' ? 'Khung giờ ra vào / Giờ mở cửa' : 'Access Hours'}
          </label>

          {/* Ô nhập trực tiếp giờ hoạt động (toàn quyền set/gõ theo ý muốn) */}
          <input
            type="text"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="VD: 06:00 - 22:00 hàng ngày"
            value={accessHours}
            onChange={(e) => onChangeAccessHours(e.target.value)}
          />

          {/* Bộ chọn nhanh giờ mở - đóng cửa */}
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span>Chọn nhanh:</span>
            <input
              type="time"
              className="border border-stone-200 rounded px-1.5 py-0.5 text-xs bg-stone-50 text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={openTime}
              onChange={(e) => handleTimeChange(e.target.value, closeTime)}
              aria-label="Giờ mở cửa"
            />
            <span className="text-stone-400">đến</span>
            <input
              type="time"
              className="border border-stone-200 rounded px-1.5 py-0.5 text-xs bg-stone-50 text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={closeTime}
              onChange={(e) => handleTimeChange(openTime, e.target.value)}
              aria-label="Giờ đóng cửa"
            />
          </div>
        </div>

        {/* Trạng thái hoạt động (chỉ dùng Tiếng Việt) */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            {lang === 'vi' ? 'Trạng thái hoạt động' : 'Initial Status'}
          </label>
          <select
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={status}
            onChange={(e) => onChangeStatus(e.target.value as 'active' | 'maintenance')}
          >
            <option value="active">Đang hoạt động</option>
            <option value="maintenance">Bảo trì</option>
          </select>
          <p className="text-[10px] text-stone-500 mt-1">
            {status === 'active' ? '● Cơ sở sẵn sàng đón khách và lưu trữ' : '▲ Cơ sở đang tạm dừng vận hành / bảo dưỡng'}
          </p>
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
    onChangeImage(WAREHOUSE_PHOTO_PRESETS[0].url)
    setLoadError(false)
  }

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
        <div className="relative w-full sm:w-44 h-32 rounded-lg overflow-hidden bg-stone-200 border border-stone-300 shrink-0 group shadow-xs">
          <img
            src={loadError ? WAREHOUSE_PHOTO_PRESETS[0].url : image || WAREHOUSE_PHOTO_PRESETS[0].url}
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
              title="Khôi phục ảnh mẫu mặc định"
              aria-label="Xóa ảnh và dùng ảnh mặc định"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
            </div>
            {loadError && (
              <p className="text-[10px] text-red-600 mt-1 font-semibold">
                Không thể tải link ảnh này, hệ thống đã chuyển về ảnh mẫu mặc định.
              </p>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-medium text-stone-500 mb-1">
              {lang === 'vi' ? 'Hoặc chọn nhanh từ thư viện ảnh kho mẫu chuẩn:' : 'Or select from presets:'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {WAREHOUSE_PHOTO_PRESETS.map((p: { id: string; title: string; url: string; description: string }) => {
                const isSelected = image === p.url
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      onChangeImage(p.url)
                      setLoadError(false)
                    }}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 ring-1 ring-amber-400'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <img src={p.url} alt={p.title} className="w-8 h-8 rounded object-cover shrink-0" />
                    <span className="text-[10px] font-medium text-stone-700 truncate leading-tight">
                      {p.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
