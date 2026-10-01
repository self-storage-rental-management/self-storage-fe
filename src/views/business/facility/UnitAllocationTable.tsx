import React, { useState, useEffect, useMemo } from 'react'
import type { FacilityCustomUnitSpec, RentalPackage } from '../../../types/storageHub'
import { getUnitTypeVehicleStandard } from '../../../domain/facilityRules'
import {
  generateDefaultRentalPackages,
  calculatePackagePrice,
  calculateDiscountPercent,
} from '../../../domain/packageRules'

export interface UnitAllocationTableProps {
  specs: FacilityCustomUnitSpec[]
  onChangeSpecs: (specs: FacilityCustomUnitSpec[]) => void
  isEditing: boolean
  occupiedMap?: Record<string, number>
  initialSpecs?: FacilityCustomUnitSpec[]
  onOpenAddSpec: () => void
  lang?: 'vi' | 'en'
  onValidationChange?: (hasErrors: boolean, errorSummary: string[]) => void
  highlightSpecCode?: string | null
}

export function formatVNDCurrency(val: number | string): string {
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10)
  if (isNaN(num)) return '0 ₫'
  return `${num.toLocaleString('vi-VN')} ₫`
}

export const UnitAllocationTable: React.FC<UnitAllocationTableProps> = ({
  specs,
  onChangeSpecs,
  isEditing,
  occupiedMap = {},
  initialSpecs = [],
  onOpenAddSpec,
  lang = 'vi',
  onValidationChange,
  highlightSpecCode,
}) => {
  // Trạng thái mở rộng chi tiết của từng dòng
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({})
  // Trạng thái dialog xác nhận xóa
  const [confirmDelete, setConfirmDelete] = useState<{
    sizeCode: string
    name: string
    occ: number
    count: number
  } | null>(null)

  // Map dữ liệu gốc để so sánh unsaved changes
  const initialMap = useMemo(() => {
    const map = new Map<string, FacilityCustomUnitSpec>()
    initialSpecs.forEach((s) => map.set(s.sizeCode, s))
    return map
  }, [initialSpecs])

  // Tự động mở rộng và scroll tới dòng mới thêm
  useEffect(() => {
    if (highlightSpecCode) {
      setExpandedCodes((prev) => ({ ...prev, [highlightSpecCode]: true }))
      setTimeout(() => {
        const el = document.getElementById(`unit-row-${highlightSpecCode}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [highlightSpecCode])

  // Kiểm tra validation toàn bảng
  const validationIssues = useMemo(() => {
    const errors: string[] = []
    const specErrors: Record<string, { lane?: string; frame?: string; count?: string; dim?: string }> = {}

    specs.forEach((s) => {
      const err: { lane?: string; frame?: string; count?: string; dim?: string } = {}
      const occ = occupiedMap[s.sizeCode] || 0

      // 1. Kiểm tra số lượng khi edit không thấp hơn occupied
      if (isEditing && s.count < occ) {
        err.count = lang === 'vi'
          ? `Đang có ${occ} gian được thuê, không thể giảm dưới ${occ}`
          : `Occupied: ${occ}. Cannot reduce below ${occ}`
        errors.push(`[${s.sizeCode}] ${err.count}`)
      }

      // 2. Kích thước kho D, R, C >= 1
      if (s.lengthM < 1 || s.widthM < 1 || (s.heightM || 1) < 1) {
        err.dim = lang === 'vi' ? 'Dài, Rộng, Cao phải ≥ 1m' : 'L, W, H must be ≥ 1m'
        errors.push(`[${s.sizeCode}] ${err.dim}`)
      }

      // 3. Chuẩn lối xe
      const std = getUnitTypeVehicleStandard(s.sizeCode, s.widthM, s.lengthM)
      const curLane = s.laneWidthM ?? std.minLaneM
      if (curLane < std.minLaneM || curLane < std.doorWidthM) {
        err.lane = lang === 'vi'
          ? `Tối thiểu ${std.minLaneM}m cho cỡ ${s.sizeCode}`
          : `Minimum ${std.minLaneM}m required for ${s.sizeCode}`
        errors.push(`[${s.sizeCode}] ${err.lane}`)
      }

      // 4. Chiều cao khung kệ <= chiều cao kho
      const frameHeight = s.frameDimensions?.heightM ?? 1
      const storageHeight = s.heightM || 4.5
      if (frameHeight > storageHeight) {
        err.frame = lang === 'vi'
          ? `Chiều cao khung (${frameHeight}m) không được vượt quá chiều cao kho (${storageHeight}m)`
          : `Frame height (${frameHeight}m) cannot exceed storage height (${storageHeight}m)`
        errors.push(`[${s.sizeCode}] ${err.frame}`)
      }

      if (Object.keys(err).length > 0) {
        specErrors[s.sizeCode] = err
      }
    })

    return { errors, specErrors }
  }, [specs, isEditing, occupiedMap, lang])

  // Thông báo lỗi lên parent form
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validationIssues.errors.length > 0, validationIssues.errors)
    }
  }, [validationIssues, onValidationChange])

  // Tính toán tổng quy mô & tải trọng
  const totalUnits = useMemo(() => specs.reduce((sum, s) => sum + s.count, 0), [specs])
  const totalDesignLoadTon = useMemo(() => {
    const totalKg = specs.reduce((sum, s) => sum + s.count * s.maxLoadKg, 0)
    return Math.round((totalKg / 1000) * 10) / 10
  }, [specs])

  const minPriceFormatted = useMemo(() => {
    const active = specs.filter((s) => s.count > 0)
    if (active.length === 0) return specs[0] ? formatVNDCurrency(specs[0].monthlyPrice) : '0 ₫'
    const min = Math.min(...active.map((s) => s.monthlyPrice))
    return formatVNDCurrency(min)
  }, [specs])

  // Helper cập nhật 1 trường của spec
  const handleUpdateSpec = (sizeCode: string, field: keyof FacilityCustomUnitSpec, value: any) => {
    onChangeSpecs(
      specs.map((s) => {
        if (s.sizeCode !== sizeCode) return s
        const updated = { ...s, [field]: value }
        if (field === 'monthlyPrice' && updated.rentalPackages && updated.rentalPackages.length > 0) {
          const newPrice = typeof value === 'number' ? value : 0
          updated.rentalPackages = updated.rentalPackages.map((pkg) => {
            const { packagePrice, monthlyEquivalentPrice } = calculatePackagePrice(
              newPrice,
              pkg.months,
              pkg.discountPercent ?? 0
            )
            return { ...pkg, packagePrice, monthlyEquivalentPrice }
          })
        }
        return updated
      })
    )
  }

  // Helper cập nhật gói thuê của spec
  const handleUpdatePackage = (
    sizeCode: string,
    packageId: string,
    updates: Partial<RentalPackage>
  ) => {
    onChangeSpecs(
      specs.map((s) => {
        if (s.sizeCode !== sizeCode) return s
        const currentPackages =
          s.rentalPackages && s.rentalPackages.length > 0
            ? s.rentalPackages
            : generateDefaultRentalPackages('', s.sizeCode, s.monthlyPrice)

        const nextPackages = currentPackages.map((pkg) => {
          if (pkg.id !== packageId) return pkg
          const next = { ...pkg, ...updates }
          if (updates.discountPercent !== undefined) {
            const calc = calculatePackagePrice(s.monthlyPrice, next.months, updates.discountPercent)
            next.packagePrice = calc.packagePrice
            next.monthlyEquivalentPrice = calc.monthlyEquivalentPrice
          } else if (updates.packagePrice !== undefined) {
            next.discountPercent = calculateDiscountPercent(s.monthlyPrice, next.months, updates.packagePrice)
            next.monthlyEquivalentPrice = Math.round(updates.packagePrice / Math.max(1, next.months))
          }
          return next
        })
        return { ...s, rentalPackages: nextPackages }
      })
    )
  }

  const handleAddCustomPackage = (sizeCode: string) => {
    onChangeSpecs(
      specs.map((s) => {
        if (s.sizeCode !== sizeCode) return s
        const currentPackages =
          s.rentalPackages && s.rentalPackages.length > 0
            ? s.rentalPackages
            : generateDefaultRentalPackages('', s.sizeCode, s.monthlyPrice)

        const existingMonths = new Set(currentPackages.map((p) => p.months))
        const candidates = [2, 9, 18, 24, 36]
        const nextMonth =
          candidates.find((m) => !existingMonths.has(m)) ||
          Math.max(...Array.from(existingMonths), 0) + 6
        const discount = nextMonth >= 24 ? 12 : nextMonth >= 12 ? 8 : 4
        const calc = calculatePackagePrice(s.monthlyPrice, nextMonth, discount)
        const newPkg: RentalPackage = {
          id: `pkg-${s.sizeCode.toLowerCase()}-${nextMonth}m-${Date.now().toString().slice(-4)}`,
          unitTypeId: s.sizeCode,
          months: nextMonth,
          name: `Gói ${nextMonth} tháng`,
          packagePrice: calc.packagePrice,
          monthlyEquivalentPrice: calc.monthlyEquivalentPrice,
          discountPercent: discount,
          description: `Gói thuê ưu đãi ${nextMonth} tháng`,
          status: 'active',
        }
        return { ...s, rentalPackages: [...currentPackages, newPkg] }
      })
    )
  }

  const handleRemoveCustomPackage = (sizeCode: string, packageId: string) => {
    onChangeSpecs(
      specs.map((s) => {
        if (s.sizeCode !== sizeCode) return s
        const currentPackages =
          s.rentalPackages && s.rentalPackages.length > 0
            ? s.rentalPackages
            : generateDefaultRentalPackages('', s.sizeCode, s.monthlyPrice)
        return {
          ...s,
          rentalPackages: currentPackages.filter((p) => p.id !== packageId),
        }
      })
    )
  }


  // Helper cập nhật kích thước khung kệ
  const handleUpdateFrameDim = (
    sizeCode: string,
    key: 'lengthM' | 'widthM' | 'heightM',
    val: number
  ) => {
    onChangeSpecs(
      specs.map((s) => {
        if (s.sizeCode !== sizeCode) return s
        const current = s.frameDimensions || { lengthM: 1, widthM: 1, heightM: 1 }
        return {
          ...s,
          frameDimensions: {
            ...current,
            [key]: val,
            ...(key === 'lengthM' ? { depthM: val } : {}),
          },
        }
      })
    )
  }

  // Toggle expand/collapse
  const toggleExpand = (sizeCode: string) => {
    setExpandedCodes((prev) => ({ ...prev, [sizeCode]: !prev[sizeCode] }))
  }

  const expandAll = () => {
    const all: Record<string, boolean> = {}
    specs.forEach((s) => (all[s.sizeCode] = true))
    setExpandedCodes(all)
  }

  const collapseAll = () => {
    setExpandedCodes({})
  }

  const isAllExpanded = specs.length > 0 && specs.every((s) => expandedCodes[s.sizeCode])

  // Kiểm tra dòng có unsaved change
  const checkIsRowDirty = (spec: FacilityCustomUnitSpec) => {
    if (!isEditing) return false
    const orig = initialMap.get(spec.sizeCode)
    if (!orig) return true // Dòng mới thêm
    return (
      spec.name !== orig.name ||
      spec.count !== orig.count ||
      spec.lengthM !== orig.lengthM ||
      spec.widthM !== orig.widthM ||
      spec.heightM !== orig.heightM ||
      spec.laneWidthM !== orig.laneWidthM ||
      spec.maxLoadKg !== orig.maxLoadKg ||
      spec.monthlyPrice !== orig.monthlyPrice ||
      spec.frameCount !== orig.frameCount ||
      spec.frameDimensions?.heightM !== orig.frameDimensions?.heightM ||
      spec.frameDimensions?.lengthM !== orig.frameDimensions?.lengthM ||
      spec.frameDimensions?.widthM !== orig.frameDimensions?.widthM
    )
  }

  // Kiểm tra cảnh báo thay đổi giá/kích thước khi đang có khách thuê
  const checkOccupiedWarning = (spec: FacilityCustomUnitSpec) => {
    if (!isEditing) return false
    const occ = occupiedMap[spec.sizeCode] || 0
    if (occ <= 0) return false
    const orig = initialMap.get(spec.sizeCode)
    if (!orig) return false
    const priceChanged = spec.monthlyPrice !== orig.monthlyPrice
    const dimChanged =
      spec.lengthM !== orig.lengthM ||
      spec.widthM !== orig.widthM ||
      spec.heightM !== orig.heightM
    return priceChanged || dimChanged
  }

  return (
    <div className="space-y-3 pt-1">
      {/* ─── Header Section ─── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3 sm:p-3.5 rounded-xl border border-amber-200/90 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 font-bold flex items-center justify-center shrink-0 shadow-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-900">
              {lang === 'vi' ? 'Phân Bổ Gian Kho & Quy Mô Thiết Kế' : 'Unit Allocation & Design Scale'}
            </h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {lang === 'vi'
                ? 'Tùy biến linh hoạt loại kho, Dài × Rộng × Cao, khung kệ, tải trọng và giá thuê'
                : 'Customize unit types, dimensions, rack frames, floor loads, and monthly rental rates'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge Tổng tải trọng thiết kế */}
          <div className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 text-sky-900 text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block animate-pulse"></span>
            <span>
              {lang === 'vi' ? 'Tổng tải trọng thiết kế (tấn):' : 'Total Design Load (ton):'}{' '}
              <b className="text-sky-950 font-extrabold text-xs sm:text-sm font-mono">{totalDesignLoadTon}</b> tấn
            </span>
          </div>

          {/* Toggle mở/thu gọn tất cả */}
          {specs.length > 0 && (
            <button
              type="button"
              onClick={isAllExpanded ? collapseAll : expandAll}
              className="px-2.5 py-1 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              title={isAllExpanded ? 'Thu gọn tất cả chi tiết' : 'Mở rộng tất cả chi tiết'}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${isAllExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>{isAllExpanded ? (lang === 'vi' ? 'Thu gọn' : 'Collapse') : (lang === 'vi' ? 'Mở rộng' : 'Expand')}</span>
            </button>
          )}

          {/* Nút Thêm Loại Kho Mới */}
          <button
            type="button"
            onClick={onOpenAddSpec}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>{lang === 'vi' ? '+ Thêm loại kho' : '+ Add Unit Type'}</span>
          </button>
        </div>
      </div>

      {/* ─── Bảng Phân Bổ (Compact Row + Expandable Details) ─── */}
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto unit-allocation-table">
          <table className="w-full table-fixed text-left text-xs border-collapse min-w-[780px]">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead className="bg-stone-100/90 border-b border-stone-200 text-stone-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">
                  {lang === 'vi' ? 'Cỡ & Loại Kho' : 'Size & Name'}
                </th>
                <th className="py-2.5 px-2">
                  {lang === 'vi' ? 'Quy Cách (D × R × C)' : 'Dimensions (L × W × H)'}
                </th>
                <th className="py-2.5 px-2 text-center">
                  {lang === 'vi' ? 'Thể Tích' : 'Volume'}
                </th>
                <th className="py-2.5 px-2 text-center">
                  {lang === 'vi' ? 'Tải Trọng Tối Đa' : 'Max Load'}
                </th>
                <th className="py-2.5 px-2 text-center">
                  {lang === 'vi' ? 'Đơn Giá / Tháng' : 'Monthly Rate'}
                </th>
                <th className="py-2.5 px-2 text-center">
                  {lang === 'vi' ? 'Số Lượng' : 'Quantity'}
                </th>
                <th className="py-2.5 px-2 text-center">
                  {lang === 'vi' ? 'Thao Tác' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/80">
              {specs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-10 h-10 text-stone-300 show-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p className="text-sm font-semibold text-stone-700">
                        {lang === 'vi' ? 'Chưa có loại kho nào trong cấu hình cơ sở' : 'No unit types configured yet'}
                      </p>
                      <p className="text-xs text-stone-400 max-w-md">
                        {lang === 'vi'
                          ? 'Vui lòng bấm "+ Thêm loại kho" bên trên để tạo cỡ kho phù hợp (S, M, L, XL, XXL...).'
                          : 'Click "+ Add Unit Type" above to define storage unit sizes for this facility.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                specs.map((spec) => {
                  const occ = occupiedMap[spec.sizeCode] || 0
                  const isExpanded = !!expandedCodes[spec.sizeCode]
                  const isBelowOcc = isEditing && spec.count < occ
                  const canDelete = !isEditing || occ === 0
                  const isDirty = checkIsRowDirty(spec)
                  const hasOccWarning = checkOccupiedWarning(spec)
                  const errors = validationIssues.specErrors[spec.sizeCode] || {}

                  const calcVol = Math.round(spec.lengthM * spec.widthM * (spec.heightM || 4.5) * 10) / 10
                  const calcArea = Math.round(spec.lengthM * spec.widthM * 10) / 10
                  const std = getUnitTypeVehicleStandard(spec.sizeCode, spec.widthM, spec.lengthM)
                  const laneWidth = spec.laneWidthM ?? std.minLaneM
                  const isLaneInvalid = laneWidth < std.minLaneM || laneWidth < std.doorWidthM
                  const frameH = spec.frameDimensions?.heightM ?? 1
                  const isFrameHeightInvalid = frameH > (spec.heightM || 4.5)

                  return (
                    <React.Fragment key={spec.sizeCode}>
                      {/* ─── Hàng chính (Main Row Compact) ─── */}
                      <tr
                        id={`unit-row-${spec.sizeCode}`}
                        className={`transition-colors ${
                          isDirty ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-stone-50/80'
                        } ${isExpanded ? 'bg-stone-50/50' : ''}`}
                      >
                        {/* 1. Cỡ & Loại kho */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs border shrink-0 shadow-2xs ${
                                spec.badgeClass || 'bg-stone-100 text-stone-800 border-stone-300'
                              }`}
                            >
                              {spec.sizeCode}
                            </span>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={spec.name}
                                  onChange={(e) => handleUpdateSpec(spec.sizeCode, 'name', e.target.value)}
                                  className="font-bold text-stone-900 text-xs bg-white border border-stone-200 hover:border-stone-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 rounded px-1.5 py-0.5 w-full max-w-[130px] truncate shadow-2xs transition"
                                  title={spec.name}
                                />
                                {isDirty && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                    Đã sửa
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-stone-400 font-mono">
                                  Mã: {spec.sizeCode}
                                </span>
                                {isEditing && (
                                  <span className="inline-flex items-center gap-0.5 px-1 rounded text-[9px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                    Đang thuê: {occ} / Tổng: {spec.count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Quy cách (D × R × C) */}
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1">
                            {/* Dài */}
                            <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-amber-500">
                              <span className="px-1 py-0.5 text-[9px] font-bold text-stone-500 bg-stone-100 border-r border-stone-200 select-none">
                                D
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                className="w-10 sm:w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={spec.lengthM}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value) || 1
                                  handleUpdateSpec(spec.sizeCode, 'lengthM', Math.max(0.1, raw))
                                }}
                                onBlur={() => {
                                  if (spec.lengthM < 1) handleUpdateSpec(spec.sizeCode, 'lengthM', 1)
                                }}
                                title="Chiều dài kho (m)"
                              />
                              <span className="pr-1 text-[9px] text-stone-400 font-mono select-none">m</span>
                            </div>

                            <span className="text-stone-400 font-bold text-xs select-none">×</span>

                            {/* Rộng */}
                            <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-amber-500">
                              <span className="px-1 py-0.5 text-[9px] font-bold text-stone-500 bg-stone-100 border-r border-stone-200 select-none">
                                R
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                className="w-10 sm:w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={spec.widthM}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value) || 1
                                  handleUpdateSpec(spec.sizeCode, 'widthM', Math.max(0.1, raw))
                                }}
                                onBlur={() => {
                                  if (spec.widthM < 1) handleUpdateSpec(spec.sizeCode, 'widthM', 1)
                                }}
                                title="Chiều rộng kho (m)"
                              />
                              <span className="pr-1 text-[9px] text-stone-400 font-mono select-none">m</span>
                            </div>

                            <span className="text-stone-400 font-bold text-xs select-none">×</span>

                            {/* Cao - viền bình thường, chỉ highlight khi focus */}
                            <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-amber-500">
                              <span className="px-1 py-0.5 text-[9px] font-bold text-stone-600 bg-stone-100 border-r border-stone-200 select-none">
                                C
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                step={0.1}
                                className="w-10 sm:w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={spec.heightM}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value) || 1
                                  handleUpdateSpec(spec.sizeCode, 'heightM', Math.max(0.1, raw))
                                }}
                                onBlur={() => {
                                  if (spec.heightM < 1) handleUpdateSpec(spec.sizeCode, 'heightM', 1)
                                }}
                                title="Chiều cao kho (m)"
                              />
                              <span className="pr-1 text-[9px] text-stone-500 font-mono select-none">m</span>
                            </div>
                          </div>
                          {errors.dim && (
                            <div className="text-[9px] font-semibold text-red-600 mt-0.5">{errors.dim}</div>
                          )}
                        </td>

                        {/* 3. Thể tích & Diện tích */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="font-bold text-stone-800 text-xs font-mono">
                            {calcVol} m³
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {calcArea} m²
                          </div>
                        </td>

                        {/* 4. Tải trọng tối đa */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden w-22 sm:w-24 h-7.5 shadow-2xs focus-within:ring-1 focus-within:ring-amber-500 focus-within:border-amber-500">
                              <input
                                type="number"
                                min={100}
                                step={50}
                                className="w-full h-full px-1 text-right font-bold text-xs bg-white text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={spec.maxLoadKg}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10)
                                  handleUpdateSpec(spec.sizeCode, 'maxLoadKg', isNaN(parsed) ? 100 : Math.max(100, parsed))
                                }}
                              />
                              <span className="px-1 text-[9px] font-bold text-stone-500 bg-stone-100 border-l border-stone-200 select-none">
                                kg
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 5. Đơn giá thuê / tháng */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <div className="w-26 sm:w-28">
                              <input
                                type="text"
                                className="w-full h-7.5 px-1.5 text-right border border-stone-300 rounded font-bold text-xs bg-white text-emerald-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                value={
                                  typeof spec.monthlyPrice === 'number'
                                    ? `${spec.monthlyPrice.toLocaleString('vi-VN')} ₫`
                                    : spec.monthlyPrice
                                }
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                  handleUpdateSpec(spec.sizeCode, 'monthlyPrice', parsed)
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 6. Số lượng kho (Stepper + Occupancy Protection) */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isEditing ? spec.count <= occ : spec.count <= 0}
                                onClick={() =>
                                  handleUpdateSpec(
                                    spec.sizeCode,
                                    'count',
                                    Math.max(isEditing ? occ : 0, spec.count - 1)
                                  )
                                }
                                className="w-7 h-7 rounded border border-stone-300 bg-stone-50 hover:bg-stone-200 active:scale-95 font-bold text-stone-700 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs shadow-2xs"
                                aria-label={`Giảm số lượng kho ${spec.sizeCode}`}
                                title={isEditing && spec.count <= occ ? `Đã chạm số lượng đang thuê (${occ})` : 'Giảm 1'}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={isEditing ? occ : 0}
                                className={`w-10 sm:w-11 h-7 text-center border rounded font-bold text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  isBelowOcc
                                    ? 'border-red-400 text-red-700 bg-red-50'
                                    : 'border-stone-300 text-stone-900'
                                }`}
                                value={spec.count}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10)
                                  handleUpdateSpec(
                                    spec.sizeCode,
                                    'count',
                                    isNaN(parsed) ? 0 : Math.max(0, parsed)
                                  )
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateSpec(spec.sizeCode, 'count', spec.count + 1)}
                                className="w-7 h-7 rounded border border-stone-300 bg-stone-50 hover:bg-stone-200 active:scale-95 font-bold text-stone-700 flex items-center justify-center transition cursor-pointer text-xs shadow-2xs"
                                aria-label={`Tăng số lượng kho ${spec.sizeCode}`}
                                title="Tăng 1"
                              >
                                +
                              </button>
                            </div>
                            {isBelowOcc && (
                              <div className="text-[9px] font-semibold text-red-600 mt-0.5 text-center">
                                Tối thiểu {occ} (đang thuê)
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 7. Thao tác: Toggle Chi tiết & Nút Xóa an toàn */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Nút Toggle Chi tiết */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(spec.sizeCode)}
                              className={`px-1.5 py-1 rounded text-[10px] font-bold border flex items-center gap-1 transition cursor-pointer ${
                                isExpanded
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                              } ${isLaneInvalid || isFrameHeightInvalid ? 'ring-1 ring-red-400 text-red-700 border-red-300' : ''}`}
                              aria-label={`Xem chi tiết thông số khung kệ và lối xe của ${spec.sizeCode}`}
                              title={isExpanded ? 'Thu gọn chi tiết' : 'Xem kích thước khung & lối xe'}
                            >
                              <span>{isExpanded ? 'Thu' : 'Chi tiết'}</span>
                              <svg
                                className={`w-3 h-3 show-icon transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Nút Xóa */}
                            <button
                              type="button"
                              disabled={!canDelete}
                              onClick={() => {
                                if (!canDelete) return
                                setConfirmDelete({
                                  sizeCode: spec.sizeCode,
                                  name: spec.name,
                                  occ,
                                  count: spec.count,
                                })
                              }}
                              className={`w-7 h-7 rounded-md flex items-center justify-center transition border btn-action-icon ${
                                canDelete
                                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 hover:text-red-700 cursor-pointer shadow-2xs'
                                  : 'border-stone-200 bg-stone-50 text-stone-300 cursor-not-allowed opacity-40'
                              }`}
                              aria-label={`Xóa loại kho ${spec.sizeCode}`}
                              title={
                                !canDelete
                                  ? `Không thể xóa vì đang có ${occ} gian kho đang được khách thuê`
                                  : `Xóa loại kho "${spec.sizeCode}"`
                              }
                            >
                              <svg className="w-3.5 h-3.5 show-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ─── Hàng Mở Rộng Chi Tiết (Expandable Details Row) ─── */}
                      {isExpanded && (
                        <tr className="bg-stone-50/70 border-b border-stone-200/80">
                          <td colSpan={7} className="p-3 pl-10">
                            <div className="space-y-2.5">
                              {/* Cảnh báo thay đổi khi đang có khách thuê */}
                              {hasOccWarning && (
                                <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                                  <svg className="w-4 h-4 show-icon text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  <span>
                                    <b>Lưu ý:</b> Loại kho này đang có <b>{occ}</b> gian được thuê. Thay đổi đơn giá hoặc kích thước sẽ áp dụng cho cả các gian đang được thuê.
                                  </span>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                                {/* Nhóm 1: Khung kệ & Số khung */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                      </svg>
                                      {lang === 'vi' ? 'Kích thước khung kệ (D × R × C)' : 'Frame Dimensions'}
                                    </span>
                                    <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-medium border border-blue-200">
                                      Đơn vị: mét (m)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 flex-wrap">
                                    {/* Dài khung */}
                                    <div className="flex items-center bg-blue-50/70 border border-blue-200 rounded overflow-hidden shadow-2xs">
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-100/90 border-r border-blue-200 select-none">
                                        D
                                      </span>
                                      <input
                                        type="number"
                                        min={0.1}
                                        max={50}
                                        step={0.1}
                                        className="w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={spec.frameDimensions?.lengthM ?? spec.frameDimensions?.depthM ?? 1}
                                        onChange={(e) =>
                                          handleUpdateFrameDim(
                                            spec.sizeCode,
                                            'lengthM',
                                            Math.max(0.1, parseFloat(e.target.value) || 0.1)
                                          )
                                        }
                                        title="Chiều dài khung kệ (m)"
                                      />
                                      <span className="pr-1 text-[9px] text-blue-600 font-mono select-none">m</span>
                                    </div>

                                    <span className="text-stone-400 font-bold text-xs select-none">×</span>

                                    {/* Rộng khung */}
                                    <div className="flex items-center bg-blue-50/70 border border-blue-200 rounded overflow-hidden shadow-2xs">
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-100/90 border-r border-blue-200 select-none">
                                        R
                                      </span>
                                      <input
                                        type="number"
                                        min={0.1}
                                        max={50}
                                        step={0.1}
                                        className="w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={spec.frameDimensions?.widthM ?? 1}
                                        onChange={(e) =>
                                          handleUpdateFrameDim(
                                            spec.sizeCode,
                                            'widthM',
                                            Math.max(0.1, parseFloat(e.target.value) || 0.1)
                                          )
                                        }
                                        title="Chiều rộng khung kệ (m)"
                                      />
                                      <span className="pr-1 text-[9px] text-blue-600 font-mono select-none">m</span>
                                    </div>

                                    <span className="text-stone-400 font-bold text-xs select-none">×</span>

                                    {/* Cao khung */}
                                    <div className="flex items-center bg-blue-50/70 border border-blue-200 rounded overflow-hidden shadow-2xs">
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-100/90 border-r border-blue-200 select-none">
                                        C
                                      </span>
                                      <input
                                        type="number"
                                        min={0.1}
                                        max={30}
                                        step={0.1}
                                        className="w-11 h-6.5 px-0.5 text-center font-bold text-xs bg-white text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={spec.frameDimensions?.heightM ?? 1}
                                        onChange={(e) =>
                                          handleUpdateFrameDim(
                                            spec.sizeCode,
                                            'heightM',
                                            Math.max(0.1, parseFloat(e.target.value) || 0.1)
                                          )
                                        }
                                        title="Chiều cao khung kệ (m)"
                                      />
                                      <span className="pr-1 text-[9px] text-blue-600 font-mono select-none">m</span>
                                    </div>

                                    {/* Số khung */}
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      <span className="text-[10px] text-stone-500 font-semibold">
                                        {lang === 'vi' ? 'Số khung:' : 'Frames:'}
                                      </span>
                                      <div className="flex items-center bg-stone-50 border border-stone-300 rounded overflow-hidden shadow-2xs">
                                        <input
                                          type="number"
                                          min={0}
                                          max={1000}
                                          step={1}
                                          className="w-12 h-6 px-1 text-center font-bold text-xs bg-white text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={spec.frameCount ?? 0}
                                          onChange={(e) => {
                                            const p = parseInt(e.target.value, 10)
                                            handleUpdateSpec(spec.sizeCode, 'frameCount', isNaN(p) ? 0 : Math.max(0, p))
                                          }}
                                          title="Số lượng khung kệ trong 1 gian kho"
                                        />
                                        <span className="px-1 text-[9px] text-stone-500 font-mono bg-stone-100 border-l border-stone-200 select-none">
                                          khung
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Lỗi chiều cao khung kệ */}
                                  {isFrameHeightInvalid && (
                                    <div className="text-[10px] font-semibold text-red-600 flex items-center gap-1">
                                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>
                                        Chiều cao khung ({frameH}m) không được vượt quá chiều cao kho ({spec.heightM || 4.5}m)
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Nhóm 2: Rộng lối xe (m) */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                      </svg>
                                      {lang === 'vi' ? 'Rộng lối xe (m)' : 'Access Lane Width (m)'}
                                    </label>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                        isLaneInvalid
                                          ? 'bg-red-50 text-red-700 border-red-200'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      }`}
                                    >
                                      {isLaneInvalid
                                        ? `Yêu cầu: ≥ ${std.minLaneM}m`
                                        : `✓ Đạt chuẩn lưu thông`}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`flex items-center rounded-lg overflow-hidden border shadow-2xs ${
                                        isLaneInvalid
                                          ? 'border-red-400 bg-red-50/50 ring-1 ring-red-300'
                                          : 'border-stone-300 bg-white focus-within:ring-1 focus-within:ring-amber-500'
                                      }`}
                                    >
                                      <input
                                        type="number"
                                        step={0.1}
                                        min={std.minLaneM}
                                        className={`w-16 h-6.5 px-1.5 text-center font-bold text-xs bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                          isLaneInvalid ? 'text-red-900 font-extrabold' : 'text-stone-900'
                                        }`}
                                        value={laneWidth}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0
                                          handleUpdateSpec(spec.sizeCode, 'laneWidthM', val)
                                        }}
                                        title={`Tối thiểu: ≥ ${std.minLaneM}m`}
                                      />
                                      <span className="px-1.5 text-[9px] font-bold text-stone-500 bg-stone-100 border-l border-stone-200 select-none">
                                        m
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-stone-500">
                                      Cửa kho: <b>{std.doorWidthM}m</b> · Phương tiện: <b>{std.vehicleType}</b>
                                    </div>
                                  </div>

                                  {isLaneInvalid && (
                                    <div className="text-[10px] font-semibold text-red-600 flex items-center gap-1">
                                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Tối thiểu {std.minLaneM}m cho cỡ {spec.sizeCode}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Nhóm 3: Thiết lập Gói thuê & Ưu đãi kỳ hạn */}
                              {(() => {
                                const rowPackages =
                                  spec.rentalPackages && spec.rentalPackages.length > 0
                                    ? spec.rentalPackages
                                    : generateDefaultRentalPackages('', spec.sizeCode, spec.monthlyPrice)

                                return (
                                  <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs select-none">
                                          🏷️
                                        </span>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-900">
                                              {lang === 'vi'
                                                ? `Gói thuê & Ưu đãi kỳ hạn: ${spec.name} (${spec.sizeCode})`
                                                : `Rental Packages: ${spec.name} (${spec.sizeCode})`}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                              {rowPackages.filter((p) => p.status === 'active').length} gói mở bán
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-stone-500 block">
                                            {lang === 'vi'
                                              ? 'Khách hàng sẽ thấy và lựa chọn đúng các gói thuê đang hoạt động này khi xem và đặt kho'
                                              : 'Customers will see and select these active packages when booking this storage unit'}
                                          </span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleAddCustomPackage(spec.sizeCode)}
                                        className="text-[11px] font-bold px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title={lang === 'vi' ? 'Thêm kỳ hạn thuê tùy chọn' : 'Add custom rental duration'}
                                      >
                                        <span className="font-bold">+</span>
                                        <span>{lang === 'vi' ? 'Thêm kỳ hạn khác' : 'Add duration'}</span>
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                      {rowPackages.map((pkg) => {
                                        const isDefaultMonths = [1, 3, 6, 12].includes(pkg.months)
                                        const isActive = pkg.status === 'active'

                                        return (
                                          <div
                                            key={pkg.id}
                                            className={`p-2.5 rounded-lg border transition space-y-2 flex flex-col justify-between ${
                                              isActive
                                                ? 'bg-emerald-50/50 border-emerald-300/80 shadow-2xs'
                                                : 'bg-stone-50/80 border-stone-200 opacity-60'
                                            }`}
                                          >
                                            {/* Header gói: Tên + Toggle Active */}
                                            <div className="flex items-center justify-between gap-1 border-b border-stone-200/60 pb-1.5">
                                              <div className="flex items-center gap-1.5">
                                                <input
                                                  type="checkbox"
                                                  id={`pkg-active-${spec.sizeCode}-${pkg.id}`}
                                                  checked={isActive}
                                                  onChange={(e) =>
                                                    handleUpdatePackage(spec.sizeCode, pkg.id, {
                                                      status: e.target.checked ? 'active' : 'inactive',
                                                    })
                                                  }
                                                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <label
                                                  htmlFor={`pkg-active-${spec.sizeCode}-${pkg.id}`}
                                                  className="font-bold text-xs text-stone-900 cursor-pointer select-none"
                                                >
                                                  {pkg.name}
                                                </label>
                                              </div>

                                              <div className="flex items-center gap-1">
                                                <span
                                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                    isActive
                                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                      : 'bg-stone-200 text-stone-600'
                                                  }`}
                                                >
                                                  {isActive ? 'Mở bán' : 'Tắt'}
                                                </span>
                                                {!isDefaultMonths && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomPackage(spec.sizeCode, pkg.id)}
                                                    className="w-4 h-4 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center font-bold text-xs"
                                                    title="Xóa kỳ hạn này"
                                                  >
                                                    ×
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Chiết khấu (%) & Giá gói tổng */}
                                            <div className="space-y-1.5 text-stone-700">
                                              <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-stone-500 font-medium">Giảm giá:</span>
                                                <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden shadow-2xs">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={0.5}
                                                    disabled={!isActive}
                                                    value={pkg.discountPercent ?? 0}
                                                    onChange={(e) =>
                                                      handleUpdatePackage(spec.sizeCode, pkg.id, {
                                                        discountPercent: Math.max(
                                                          0,
                                                          Math.min(100, parseFloat(e.target.value) || 0)
                                                        ),
                                                      })
                                                    }
                                                    className="w-12 h-6 px-1 text-right font-bold text-xs bg-transparent text-emerald-800 focus:outline-none disabled:opacity-40"
                                                  />
                                                  <span className="px-1 text-[10px] font-bold text-stone-500 bg-stone-50 border-l border-stone-200 select-none">
                                                    %
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-stone-500 font-medium">Giá trọn gói:</span>
                                                <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden shadow-2xs">
                                                  <input
                                                    type="text"
                                                    disabled={!isActive}
                                                    value={
                                                      typeof pkg.packagePrice === 'number'
                                                        ? pkg.packagePrice.toLocaleString('vi-VN')
                                                        : pkg.packagePrice
                                                    }
                                                    onChange={(e) => {
                                                      const parsed =
                                                        parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                                      handleUpdatePackage(spec.sizeCode, pkg.id, {
                                                        packagePrice: parsed,
                                                      })
                                                    }}
                                                    className="w-22 h-6 px-1 text-right font-bold text-xs bg-transparent text-stone-900 focus:outline-none disabled:opacity-40"
                                                  />
                                                  <span className="px-1 text-[10px] font-bold text-stone-500 bg-stone-50 border-l border-stone-200 select-none">
                                                    ₫
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Đơn giá tương đương theo tháng */}
                                            <div className="pt-1 border-t border-stone-200/50 flex items-center justify-between text-[10px] text-stone-500">
                                              <span>Tương đương:</span>
                                              <span className="font-semibold text-emerald-900">
                                                {pkg.monthlyEquivalentPrice.toLocaleString('vi-VN')} ₫/tháng
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
            {/* ─── Chân Bảng (Footer) ─── */}
            <tfoot className="bg-stone-50 border-t-2 border-stone-200 font-semibold text-stone-800">
              <tr>
                <td colSpan={2} className="py-2.5 px-3">
                  <div className="font-bold text-stone-900 text-xs">
                    {lang === 'vi' ? 'Tổng cộng thiết kế quy hoạch' : 'Total Facility Plan'}
                  </div>
                  <div className="text-[10px] text-stone-500 font-normal">
                    {lang === 'vi'
                      ? `${specs.length} loại kho được định cấu hình cho cơ sở`
                      : `${specs.length} unit types configured`}
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center"></td>
                <td className="py-2.5 px-2 text-center font-mono">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-100/80 border border-sky-300 text-sky-950 font-extrabold text-[11px] shadow-2xs">
                    <span className="text-[10px] font-semibold text-sky-800">
                      {lang === 'vi' ? 'Tổng tải:' : 'Total load:'}
                    </span>
                    <span>{totalDesignLoadTon}</span>
                    <span className="text-[10px] font-semibold text-sky-800">tấn</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center text-xs text-stone-400">
                  <span className="font-mono text-stone-700 font-bold">
                    {lang === 'vi' ? 'Từ' : 'From'} {minPriceFormatted}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-950 font-extrabold text-xs shadow-2xs">
                    <span className="text-xs font-black">{totalUnits}</span>
                    <span className="text-[10px] font-bold text-amber-900">
                      {lang === 'vi' ? 'kho' : 'units'}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Thông báo lỗi tổng số gian kho = 0 */}
      {totalUnits <= 0 && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">
            {lang === 'vi' ? 'Cần ít nhất 1 loại kho có số lượng > 0' : 'At least 1 unit type must have quantity > 0'}
          </span>
        </div>
      )}

      {/* ─── Modal Xác Nhận Xóa Loại Kho ─── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">
                  {lang === 'vi' ? 'Xác nhận xóa loại kho?' : 'Confirm Delete Storage Type?'}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {lang === 'vi' ? (
                    <>
                      Bạn đang chọn xóa loại kho{' '}
                      <b className="text-stone-900 font-bold">
                        {confirmDelete.sizeCode} ({confirmDelete.name})
                      </b>{' '}
                      khỏi cấu hình cơ sở này.{' '}
                      {confirmDelete.count > 0 && (
                        <span className="text-red-600 font-semibold block mt-1">
                          Thao tác này sẽ xóa {confirmDelete.count} gian kho thuộc loại này.
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      You are about to delete unit type{' '}
                      <b className="text-stone-900 font-bold">
                        {confirmDelete.sizeCode} ({confirmDelete.name})
                      </b>.{' '}
                      {confirmDelete.count > 0 && (
                        <span className="text-red-600 font-semibold block mt-1">
                          This will remove {confirmDelete.count} units from configuration.
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetCode = confirmDelete.sizeCode
                  setConfirmDelete(null)
                  onChangeSpecs(specs.filter((s) => s.sizeCode !== targetCode))
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{lang === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
