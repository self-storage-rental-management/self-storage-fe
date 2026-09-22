import { useState, useEffect } from 'react'
import BrandLogo from '../../components/BrandLogo'
import { useStorageHub } from '../../store/StorageHubContext'
import { FACILITIES } from '../../data/demoDatabase'

interface HomePageProps {
  onOpenLogin: () => void
  onOpenRegister: () => void
}

// Inline SVG Icons with explicit inline styles to guarantee visibility
function WarehouseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function ShieldCheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function BoxIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function KeyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}

function MapPinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ThermometerIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function XMarkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function HomePage({ onOpenLogin, onOpenRegister }: HomePageProps) {
  const { facilities: contextFacilities } = useStorageHub()
  const [activeModal, setActiveModal] = useState<'facilities' | 'unit_types' | 'how_it_works' | null>(null)

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const [selectedFacilityTab, setSelectedFacilityTab] = useState('all')

  // Combine demo database and context facilities
  const facilitiesList = (contextFacilities && contextFacilities.length > 0) ? contextFacilities : FACILITIES

  const unitCategories = [
    {
      id: 'small',
      name: 'Tủ Đồ Mini & Gian Nhỏ (Small Locker)',
      size: 'Kho nhỏ · khoảng 2,3 m² · 7 m³',
      desc: 'Phù hợp để tài liệu cá nhân, vali du lịch, quần áo theo mùa, đồ trượt tuyết hoặc 5-8 thùng carton tiêu chuẩn.',
      estRate: 'Từ 850.000 ₫ / tháng',
      badge: 'Cá nhân & Gia đình',
      highlight: 'Khóa mã PIN 24/7'
    },
    {
      id: 'medium',
      name: 'Gian Kho Tiêu Chuẩn (Medium Unit)',
      size: 'Kho vừa · khoảng 9,3 m² · 28 m³',
      desc: 'Lưu trữ toàn bộ nội thất căn hộ 1-2 phòng ngủ, thiết bị văn phòng, bàn ghế, tủ lạnh và hàng mẫu kinh doanh online.',
      estRate: 'Từ 2.200.000 ₫ / tháng',
      badge: 'Phổ biến nhất',
      highlight: 'Kiểm soát nhiệt độ 24°C'
    },
    {
      id: 'large',
      name: 'Kho Thương Mại & Doanh Nghiệp (Large Unit)',
      size: 'Kho lớn · khoảng 18,6–37 m²',
      desc: 'Dành cho tồn kho thương mại điện tử, máy móc cơ khí, thiết bị sự kiện và toàn bộ nội thất biệt thự/nhà lớn.',
      estRate: 'Từ 4.500.000 ₫ / tháng',
      badge: 'Doanh nghiệp',
      highlight: 'Xe tải bốc dỡ tận cửa'
    },
    {
      id: 'climate',
      name: 'Kho Kiểm Soát Vi Khí Hậu (Climate-Controlled)',
      size: 'Đa dạng diện tích từ 5m² đến 30m²',
      desc: 'Duy trì nhiệt độ 20-23°C và độ ẩm ổn định 50-60%. Chuyên dụng cho rượu vang, tranh nghệ thuật, hồ sơ lưu trữ lâu năm.',
      estRate: 'Liên hệ báo giá chi tiết',
      badge: 'Cao cấp',
      highlight: 'Cảm biến độ ẩm thông minh'
    }
  ]

  const workflowSteps = [
    {
      num: '01',
      title: 'Chọn cơ sở & quy cách kho',
      desc: 'Tìm kiếm cơ sở kho gần nhất, lựa chọn kích thước phù hợp với nhu cầu và thời gian bắt đầu dự kiến.'
    },
    {
      num: '02',
      title: 'Gửi yêu cầu đặt giữ kho',
      desc: 'Đặt giữ trực tuyến nhanh chóng. Hệ thống ghi nhận yêu cầu và bảo lưu vị trí kho cho bạn.'
    },
    {
      num: '03',
      title: 'Xét duyệt & ký xác nhận hợp đồng',
      desc: 'Quản lý cơ sở kiểm tra mặt bằng, phân gán mã gian kho cụ thể và hai bên hoàn tất xác nhận điều khoản hợp đồng.'
    },
    {
      num: '04',
      title: 'Thanh toán & nhận kho (ACTIVE)',
      desc: 'Hoàn tất thanh toán, nhận mã PIN khóa điện tử thông minh và bắt đầu lưu trữ tự do 24/7.'
    }
  ]

  return (
    <div className="home-page min-h-screen bg-[#F7F6F0] text-[#222220] flex flex-col font-sans selection:bg-[#E89520] selection:text-white">
      {/* ── 1. HEADER NAVBAR ───────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#1F1F1D] text-white border-b border-[#353630] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <BrandLogo light subtitle="Hệ Thống Tự Lưu Trữ" />
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-stone-300">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-[#E89520] hover:text-[#E89520] transition-colors pb-1 border-b-2 border-[#E89520] cursor-pointer"
            >
              Trang Chủ
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('facilities')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Cơ Sở Kho
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('unit_types')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Loại Gian Kho
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('how_it_works')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Quy Trình Thuê
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Ưu Điểm
            </button>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stone-200 border border-[#44453F] hover:bg-[#2D2E29] hover:text-white hover:border-stone-400 transition-all cursor-pointer"
            >
              Đăng Ký
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#E89520] hover:bg-[#D98514] text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Đăng Nhập</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION ───────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* Left Column: Value Proposition */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[#9A5A05] text-xs font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#E89520] animate-ping" />
                <span>GIẢI PHÁP LƯU KHO THÔNG MINH CHO CÁ NHÂN & DOANH NGHIỆP</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-stone-900 leading-tight tracking-tight">
                  Lưu trữ thông minh,
                </h1>
                <p className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#E89520] leading-tight tracking-tight">
                  An tâm mỗi ngày & Linh hoạt 24/7
                </p>
              </div>

              <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-2xl">
                StorageHub cung cấp hệ thống kho tự lưu trữ (Self-Storage) đạt chuẩn an ninh quốc tế. Tìm kiếm cơ sở thuận tiện, lựa chọn quy cách kho đa dạng, đặt giữ chỗ trực tuyến và kiểm soát quyền ra vào thông minh hoàn toàn trên một nền tảng hợp nhất.
              </p>

              {/* Call to Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="bg-[#E89520] hover:bg-[#D98514] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Đặt Giữ Kho Ngay</span>
                  <ArrowRightIcon className="w-4 h-4 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('facilities')}
                  className="bg-stone-50 hover:bg-stone-100 text-stone-800 font-semibold text-sm px-5 py-3 rounded-xl border border-stone-300 hover:border-stone-400 transition-all cursor-pointer flex items-center gap-2"
                >
                  <MapPinIcon className="w-4 h-4 text-[#E89520]" />
                  <span>Khám Phá Cơ Sở</span>
                </button>
              </div>

              {/* Quick Trust Badges */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-stone-100 text-center sm:text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">500+</div>
                  <div className="text-xs text-stone-500 mt-0.5">Gian kho sẵn sàng</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">24/7</div>
                  <div className="text-xs text-stone-500 mt-0.5">Camera & Khóa mã số</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600">99.8%</div>
                  <div className="text-xs text-stone-500 mt-0.5">Độ an tâm khách hàng</div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Operational Graphic */}
            <div className="lg:col-span-5 bg-gradient-to-br from-stone-900 to-[#2A2B26] text-white rounded-xl border border-stone-700 p-6 flex flex-col justify-between shadow-2xl">

              {/* Graphic Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-700 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-stone-200 uppercase tracking-wide">MẠNG LƯỚI VẬN HÀNH KHO</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30">HOẠT ĐỘNG</span>
              </div>

              {/* Graphic Unit Tiers */}
              <div className="my-5 space-y-3 font-mono">
                <div className="bg-[#1C1D1A] p-3.5 rounded-lg border border-stone-700 flex items-center justify-between hover:border-amber-500/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#E89520]">
                      <BoxIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Gian Nhỏ (Small · 2,3 m²)</div>
                      <div className="text-[11px] text-stone-400">98% Khả dụng · Khóa PIN điện tử</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#E89520] bg-amber-500/10 px-2 py-1 rounded">Từ 850.000 ₫</span>
                </div>

                <div className="bg-[#1C1D1A] p-3.5 rounded-lg border border-stone-700 flex items-center justify-between hover:border-amber-500/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <WarehouseIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Gian Vừa (Medium · 9,3 m²)</div>
                      <div className="text-[11px] text-stone-400">Điều hòa nhiệt độ · 24/7 Ra vào</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#E89520] bg-amber-500/10 px-2 py-1 rounded">Từ 2.200.000 ₫</span>
                </div>

                <div className="bg-[#1C1D1A] p-3.5 rounded-lg border border-stone-700 flex items-center justify-between hover:border-amber-500/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <KeyIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Kho Lớn (Large · 18,6 m²)</div>
                      <div className="text-[11px] text-stone-400">Xe tải bốc dỡ · Cửa cuốn tự động</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#E89520] bg-amber-500/10 px-2 py-1 rounded">Từ 4.500.000 ₫</span>
                </div>
              </div>

              {/* Graphic Bottom Status */}
              <div className="pt-3 border-t border-stone-700 flex items-center justify-between text-[11px] text-stone-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                  <span>Bảo vệ & Giám sát CCTV</span>
                </span>
                <span className="font-mono font-semibold text-stone-300">Downtown & Riverside</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. FOUR CORE PILLARS / FEATURES ────────────────── */}
      <section id="features" className="scroll-mt-16 py-12 bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E89520]">ƯU ĐIỂM VƯỢT TRỘI</span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900">
              Tiêu Chuẩn Lưu Trữ Hiện Đại & An Ninh Tuyệt Đối
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Thiết kế chuyên biệt cho thị trường Việt Nam, đáp ứng tiêu chuẩn khắt khe về an toàn phòng cháy, kiểm soát nhiệt ẩm và quyền riêng tư cá nhân.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-[#9A5A05] flex items-center justify-center mb-4">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-2">An Ninh Giám Sát 24/7</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Hệ thống camera AI bao quát toàn diện, kiểm soát ra vào bằng mã PIN cá nhân hoặc thẻ từ RFID, bảo vệ trực ban 24/7.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <ThermometerIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-2">Kiểm Soát Vi Khí Hậu</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Không gian khô ráo, nhiệt độ và độ ẩm luôn được duy trì ổn định, ngăn ngừa nấm mốc, bảo vệ hàng hóa giá trị cao.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <ClockIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-2">Đặt Chỗ & Thanh Toán Tự Động</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Xem phòng trống theo thời gian thực, đặt giữ chỗ trực tuyến, xuất hóa đơn VAT điện tử và thanh toán chuyển khoản linh hoạt.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                <KeyIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-2">Quản Lý Tập Trung Minh Bạch</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Theo dõi hợp đồng, gia hạn, trả kho hoặc yêu cầu hỗ trợ kỹ thuật trực tiếp ngay trên cổng thông tin người dùng cá nhân.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. UNIT TYPES SECTION ──────────────────────────── */}
      <section id="unit-types" className="scroll-mt-16 py-12 bg-[#F7F6F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E89520]">QUY CÁCH ĐA DẠNG</span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900">
                Các Loại Gian Kho Lưu Trữ
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Tối ưu chi phí bằng cách lựa chọn diện tích chính xác theo nhu cầu thực tế của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('unit_types')}
              className="mt-4 md:mt-0 text-xs font-bold text-[#E89520] hover:text-[#9A5A05] flex items-center gap-1 cursor-pointer"
            >
              <span>Xem chi tiết thông số kỹ thuật</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {unitCategories.map(cat => (
              <div key={cat.id} className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-[#9A5A05] border border-amber-200">
                      {cat.badge}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>{cat.highlight}</span>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-stone-900 leading-snug">{cat.name}</h3>
                  <div className="mt-1 font-mono text-xs text-[#E89520] font-semibold">{cat.size}</div>
                  <p className="mt-3 text-xs text-stone-600 leading-relaxed">{cat.desc}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Ước tính giá</div>
                    <div className="text-xs font-bold text-stone-900">{cat.estRate}</div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-900 hover:bg-[#E89520] text-white transition cursor-pointer"
                  >
                    Chọn Thuê
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. FACILITIES NETWORK SECTION ───────────────────── */}
      <section id="facilities" className="scroll-mt-16 py-12 bg-white border-t border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E89520]">MẠNG LƯỚI KHO BÃI</span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900">
                Hệ Thống Cơ Sở StorageHub
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Vị trí đắc địa tại trung tâm các thành phố lớn, thuận tiện di chuyển và vận chuyển hàng hóa.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('facilities')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${selectedFacilityTab === 'all' ? 'bg-[#E89520] text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              >
                Xem danh sách cơ sở ({facilitiesList.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilitiesList.map(fac => (
              <div key={fac.id} className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-[#9A5A05] px-2 py-0.5 rounded">
                      MÃ: {fac.id}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{fac.available ?? 18} gian khả dụng</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900">{fac.name}</h3>
                  <p className="text-xs text-stone-600 mt-1 flex items-start gap-1.5">
                    <MapPinIcon className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <span>{fac.address}, {fac.city}</span>
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-stone-200">
                    <div>
                      <span className="text-stone-400 text-[10px] block">QUY MÔ</span>
                      <span className="font-bold text-stone-800">{fac.units ?? 100} Gian kho</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] block">AN NINH</span>
                      <span className="font-bold text-stone-800">24/7 CCTV & PIN</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
                  <span className="text-xs text-stone-600 font-medium">
                    Giá từ <strong className="text-stone-900">{fac.price ?? '850.000'} đ</strong>/tháng
                  </span>
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#E89520] hover:bg-[#D98514] text-white transition cursor-pointer"
                  >
                    Đặt Giữ Chỗ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. HOW IT WORKS WORKFLOW ───────────────────────── */}
      <section id="how-it-works" className="scroll-mt-16 py-12 bg-[#F7F6F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E89520]">QUY TRÌNH TINH GỌN</span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900">
              4 Bước Bắt Đầu Thuê Kho Dễ Dàng
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Minh bạch, an toàn và đảm bảo quyền lợi tuyệt đối cho khách hàng và doanh nghiệp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {workflowSteps.map(step => (
              <div key={step.num} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
                <span className="text-3xl font-black font-mono text-amber-200 block mb-2">
                  {step.num}
                </span>
                <h3 className="text-base font-bold text-stone-900 mb-2">{step.title}</h3>
                <p className="text-xs text-stone-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setActiveModal('how_it_works')}
              className="mr-2 border border-stone-300 bg-white text-stone-800 hover:border-stone-400 font-semibold text-sm px-6 py-3 rounded-xl transition cursor-pointer inline-flex items-center gap-2"
            >
              Xem quy trình chi tiết
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="bg-[#E89520] hover:bg-[#D98514] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition cursor-pointer inline-flex items-center gap-2"
            >
              <span>Bắt Đầu Tạo Yêu Cầu Thuê Kho</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. ENTERPRISE FOOTER ────────────────────────────── */}
      <footer className="bg-[#1F1F1D] text-white border-t border-[#353630] pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-[#353630]">

            {/* Col 1: Brand & Bio */}
            <div className="space-y-3">
              <BrandLogo light subtitle="Nền Tảng Quản Lý Kho Bãi" />
              <p className="text-xs text-stone-400 leading-relaxed">
                Hệ thống tự lưu trữ thông minh chuẩn quốc tế. Cung cấp giải pháp lưu trữ an toàn, linh hoạt và công nghệ cao cho cá nhân và tổ chức.
              </p>
              <div className="text-xs text-stone-400">
                <strong>Hotline hỗ trợ:</strong> <span className="text-[#E89520] font-bold">1900 8888 (24/7)</span>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 mb-3 font-mono">DỊCH VỤ LƯU TRỮ</h4>
              <ul className="space-y-2 text-xs text-stone-400">
                <li><button type="button" onClick={() => scrollToSection('unit-types')} className="hover:text-white transition cursor-pointer">Tủ đồ mini & cá nhân</button></li>
                <li><button type="button" onClick={() => scrollToSection('unit-types')} className="hover:text-white transition cursor-pointer">Kho đồ gia đình & chuyển nhà</button></li>
                <li><button type="button" onClick={() => scrollToSection('unit-types')} className="hover:text-white transition cursor-pointer">Kho hàng thương mại điện tử</button></li>
                <li><button type="button" onClick={() => scrollToSection('unit-types')} className="hover:text-white transition cursor-pointer">Kho kiểm soát vi khí hậu</button></li>
              </ul>
            </div>

            {/* Col 3: Facilities */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 mb-3 font-mono">CƠ SỞ TRỌNG ĐIỂM</h4>
              <ul className="space-y-2 text-xs text-stone-400">
                <li>Downtown Storage – 125 Nguyễn Huệ, Q.1</li>
                <li>Riverside Storage – 42 Bạch Đằng, Bình Thạnh</li>
                <li>Westside Storage – KCN Tân Bình, Tân Phú</li>
                <li>Hệ thống cơ sở đối tác toàn quốc</li>
              </ul>
            </div>

            {/* Col 4: Operations & Security */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 mb-3 font-mono">TIÊU CHUẨN AN TOÀN</h4>
              <ul className="space-y-2 text-xs text-stone-400">
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" /> <span>PCCC tiêu chuẩn Bộ Công An</span></li>
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" /> <span>Bảo hiểm rủi ro tài sản</span></li>
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" /> <span>Hợp đồng điện tử xác thực</span></li>
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" /> <span>Hóa đơn VAT điện tử minh bạch</span></li>
              </ul>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <p>© {new Date().getFullYear()} StorageHub Self-Storage Management System. Tất cả các quyền được bảo lưu.</p>
            <div className="flex gap-4">
              <span className="hover:text-stone-400 cursor-pointer">Điều khoản dịch vụ</span>
              <span>·</span>
              <span className="hover:text-stone-400 cursor-pointer">Chính sách bảo mật</span>
              <span>·</span>
              <span className="hover:text-stone-400 cursor-pointer">Quy chế lưu kho</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── 8. INFORMATIONAL POPUP MODALS ──────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-[#E89520]" />
                <span>
                  {activeModal === 'facilities' && 'Danh Sách Cơ Sở Lưu Trữ StorageHub'}
                  {activeModal === 'unit_types' && 'Danh Mục Chi Tiết Các Loại Gian Kho'}
                  {activeModal === 'how_it_works' && 'Quy Trình Đặt Giữ & Bàn Giao Kho'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 border border-stone-300 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Đóng (hoặc nhấn Esc)"
              >
                <span className="text-sm font-bold">✕</span>
                <span>Đóng</span>
              </button>
            </div>

            {/* Modal Content: Facilities */}
            {activeModal === 'facilities' && (
              <div className="mt-4 space-y-4 text-xs">
                <p className="text-stone-600 text-sm">
                  StorageHub hiện đang vận hành các cơ sở lưu trữ tại các vị trí giao thông thuận tiện, trang bị camera giám sát và đội ngũ quản lý chuyên nghiệp:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facilitiesList.map(f => (
                    <div key={f.id} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between font-bold text-stone-900 text-sm">
                          <span>{f.name}</span>
                          <span className="text-[10px] bg-amber-100 text-[#9A5A05] px-1.5 py-0.5 rounded font-mono font-bold">{f.id}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1 flex items-start gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-400" />
                          <span>{f.address}, {f.city}</span>
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
                        <span>{f.units ?? 100} đơn vị</span>
                        <span className="font-semibold text-emerald-700">Khả dụng: {f.available ?? 18}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null)
                      onOpenRegister()
                    }}
                    className="bg-[#E89520] hover:bg-[#D98514] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Đặt giữ kho tại cơ sở này</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Modal Content: Unit Types */}
            {activeModal === 'unit_types' && (
              <div className="mt-4 space-y-4 text-xs">
                <p className="text-stone-600 text-sm">
                  StorageHub cung cấp các loại đơn vị lưu trữ đa dạng, đáp ứng mọi quy mô từ đồ dùng cá nhân đến hàng hóa doanh nghiệp:
                </p>
                <div className="space-y-3">
                  {unitCategories.map(c => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-[#E89520] shrink-0">
                        <BoxIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between font-bold text-stone-900 text-sm">
                          <span>{c.name}</span>
                          <span className="text-xs text-[#E89520] font-mono font-bold">{c.estRate}</span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-bold mt-0.5">{c.size}</p>
                        <p className="text-xs text-stone-600 mt-1">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null)
                      onOpenRegister()
                    }}
                    className="bg-[#E89520] hover:bg-[#D98514] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Gửi yêu cầu đặt loại đơn vị này</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Modal Content: How It Works */}
            {activeModal === 'how_it_works' && (
              <div className="mt-4 space-y-4 text-xs">
                <p className="text-stone-600 text-sm">
                  Quy trình đặt giữ và thuê kho tại StorageHub được thiết kế an toàn, minh bạch qua 4 bước chuẩn nghiệp vụ:
                </p>
                <div className="space-y-3">
                  {workflowSteps.map(step => (
                    <div key={step.num} className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#E89520] text-white font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                        {step.num}
                      </span>
                      <div>
                        <h4 className="font-bold text-stone-900 text-sm">{step.title}</h4>
                        <p className="text-xs text-stone-600 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null)
                      onOpenRegister()
                    }}
                    className="bg-[#E89520] hover:bg-[#D98514] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Bắt đầu đặt giữ kho ngay</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
