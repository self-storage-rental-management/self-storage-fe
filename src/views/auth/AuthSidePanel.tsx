import BrandLogo from '../../components/BrandLogo'

interface AuthSidePanelProps {
  tab: 'login' | 'register'
}

export default function AuthSidePanel({ tab }: AuthSidePanelProps) {
  return (
    <section className="hidden md:flex flex-col justify-between bg-[#1F2328] p-10 text-white relative overflow-hidden select-none">
      {/* ── Background: Storage Roller Door Grid Pattern (Pure SVG, 5-8% opacity) ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07] show-svg" aria-hidden="true">
        <svg className="show-icon w-full h-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="storage-doors" width="90" height="110" patternUnits="userSpaceOnUse">
              {/* Outer door frame */}
              <rect x="5" y="5" width="80" height="100" rx="3" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
              {/* Horizontal roller slats */}
              <line x1="5" y1="25" x2="85" y2="25" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="5" y1="45" x2="85" y2="45" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="5" y1="65" x2="85" y2="65" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="5" y1="85" x2="85" y2="85" stroke="#FFFFFF" strokeWidth="1" />
              {/* Handle */}
              <rect x="38" y="94" width="14" height="4" rx="2" fill="#FFFFFF" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#storage-doors)" />
        </svg>
      </div>

      {/* Subtle Orange Tint Accent on specific cells */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#F59E0B]/[0.10] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-[#F59E0B]/[0.08] rounded-full blur-3xl pointer-events-none" />

      {/* ── Top: Logo (approx 40px height) ── */}
      <div className="relative z-10">
        <BrandLogo light imgClassName="h-10 w-auto max-w-full object-contain" />
      </div>

      {/* ── Middle: Centered Content Block (Vertically Centered with my-auto) ── */}
      <div className="relative z-10 my-auto flex flex-col justify-center py-4">
        {/* Dynamic Title & Slogan with Fade Animation */}
        <div
          key={`header-${tab}`}
          className="transition-opacity duration-300 ease-in-out animate-in fade-in"
        >
          {tab === 'login' ? (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wider text-[#F59E0B] uppercase">
                Hệ thống tự lưu trữ
              </p>
              <h1 className="mb-3 text-[26px] font-bold leading-tight text-white">
                Quản lý kho tự phục vụ, mọi lúc mọi nơi
              </h1>
              <p className="mb-6 max-w-[34ch] text-[12.5px] leading-relaxed text-[#B6BDC8]">
                Hệ thống hợp nhất giúp khách thuê và đội ngũ cơ sở quản lý kho bãi, thanh toán và kiểm soát ra vào bảo mật.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wider text-[#F59E0B] uppercase">
                Khởi đầu tiện lợi
              </p>
              <h1 className="mb-3 text-[26px] font-bold leading-tight text-white">
                Bắt đầu lưu trữ cùng StorageHub
              </h1>
              <p className="mb-6 max-w-[34ch] text-[12.5px] leading-relaxed text-[#B6BDC8]">
                Trải nghiệm giải pháp tự lưu trữ chuẩn quốc tế. Đăng ký trong tích tắc để quản lý không gian kho riêng của bạn.
              </p>
            </div>
          )}
        </div>

        {/* ── 3 Highlights (Replacing fabricated 500+/98%/24/7) ── */}
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-stone-700/60 bg-[#262B32]/90 p-3 text-center shadow-sm">
            <svg className="show-icon w-5 h-5 mx-auto mb-1.5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="block text-[11px] font-semibold leading-tight text-stone-200">
              Đặt kho trong vài phút
            </span>
          </div>

          <div className="rounded-xl border border-stone-700/60 bg-[#262B32]/90 p-3 text-center shadow-sm">
            <svg className="show-icon w-5 h-5 mx-auto mb-1.5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="block text-[11px] font-semibold leading-tight text-stone-200">
              Mã PIN mở cửa tự động
            </span>
          </div>

          <div className="rounded-xl border border-stone-700/60 bg-[#262B32]/90 p-3 text-center shadow-sm">
            <svg className="show-icon w-5 h-5 mx-auto mb-1.5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="block text-[11px] font-semibold leading-tight text-stone-200">
              Gia hạn online
            </span>
          </div>
        </div>

        {/* ── Register only: 3-step rental process (Login does not have redundant 4 bullets) ── */}
        {tab === 'register' && (
          <div className="transition-opacity duration-300 ease-in-out animate-in fade-in">
            <p className="mb-3 text-[11px] font-bold tracking-wider text-[#9CA3AF] uppercase">
              Quy trình 3 bước thuê kho
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-black text-stone-900">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Chọn kho phù hợp</h4>
                  <p className="text-[12px] text-[#B6BDC8] mt-0.5">Lựa chọn cơ sở thuận tiện và quy cách kho tối ưu (S, M, L, XL).</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-black text-stone-900">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Đặt cọc và xác nhận</h4>
                  <p className="text-[12px] text-[#B6BDC8] mt-0.5">Đặt giữ trực tuyến, xác nhận hợp đồng điện tử an toàn, minh bạch.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-black text-stone-900">
                  3
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Check-in nhận mã PIN</h4>
                  <p className="text-[12px] text-[#B6BDC8] mt-0.5">Nhận mã khóa điện tử bảo mật và bắt đầu tự do lưu trữ 24/7.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer note on Panel (High Contrast & Sentence Case) ── */}
      <div className="relative z-10 pt-5 border-t border-stone-700/80 text-xs text-[#B6BDC8] flex items-center justify-between">
        <span className="font-medium">© {new Date().getFullYear()} StorageHub</span>
        <span className="text-[#F59E0B] font-semibold">An toàn · Tiện lợi · 24/7</span>
      </div>
    </section>
  )
}
