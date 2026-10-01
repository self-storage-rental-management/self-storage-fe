import React, { useState, useMemo, useEffect } from 'react'
import { Modal } from '../../../components/ui'
import type { FacilityCustomUnitSpec } from '../../../types/storageHub'
import { getUnitTypeVehicleStandard } from '../../../domain/facilityRules'
import { formatVNDCurrency } from './UnitAllocationTable'

export interface AddUnitSpecModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (spec: FacilityCustomUnitSpec) => void
  existingSpecs: FacilityCustomUnitSpec[]
  lang?: 'vi' | 'en'
}

export const AddUnitSpecModal: React.FC<AddUnitSpecModalProps> = ({
  open,
  onClose,
  onConfirm,
  existingSpecs,
  lang = 'vi',
}) => {
  // Gợi ý mã và tên tự động khi mở modal
  const defaultSuggestion = useMemo(() => {
    const hasXXL = existingSpecs.some((s) => s.sizeCode === 'XXL')
    const nextIdx = existingSpecs.length + 1
    return {
      code: hasXXL ? `CUST${nextIdx}` : 'XXL',
      name: hasXXL ? `Kho Mở Rộng ${nextIdx}` : 'Kho Ngoại Khổ (XXL)',
    }
  }, [existingSpecs])

  // Form states
  const [sizeCode, setSizeCode] = useState<string>(defaultSuggestion.code)
  const [name, setName] = useState<string>(defaultSuggestion.name)
  const [lengthM, setLengthM] = useState<number>(25.0)
  const [widthM, setWidthM] = useState<number>(12.0)
  const [heightM, setHeightM] = useState<number>(5.0)
  const [laneWidthM, setLaneWidthM] = useState<number>(5.0)
  const [maxLoadKg, setMaxLoadKg] = useState<number>(4500)
  const [monthlyPrice, setMonthlyPrice] = useState<number>(28000000)
  const [priceInputText, setPriceInputText] = useState<string>('28.000.000 ₫')
  const [count, setCount] = useState<number>(5)
  const [floor, setFloor] = useState<number>(1)
  const [zone, setZone] = useState<string>('Khu A')

  // Frame specs
  const [frameCount, setFrameCount] = useState<number>(12)
  const [frameLengthM, setFrameLengthM] = useState<number>(4.0)
  const [frameWidthM, setFrameWidthM] = useState<number>(2.0)
  const [frameHeightM, setFrameHeightM] = useState<number>(4.5)

  // Reset form khi modal mở
  useEffect(() => {
    if (open) {
      setSizeCode(defaultSuggestion.code)
      setName(defaultSuggestion.name)
      setLengthM(25.0)
      setWidthM(12.0)
      setHeightM(5.0)
      setLaneWidthM(5.0)
      setMaxLoadKg(4500)
      setMonthlyPrice(28000000)
      setPriceInputText('28.000.000 ₫')
      setCount(5)
      setFloor(((existingSpecs.length % 4) + 1))
      setZone(`Khu ${String.fromCharCode(65 + (existingSpecs.length % 4))}`)
      setFrameCount(12)
      setFrameLengthM(4.0)
      setFrameWidthM(2.0)
      setFrameHeightM(4.5)
    }
  }, [open, defaultSuggestion, existingSpecs.length])

  // Chuẩn xe và lối xe theo kích thước
  const vehicleStandard = useMemo(() => {
    return getUnitTypeVehicleStandard(sizeCode, widthM || 12, lengthM || 25)
  }, [sizeCode, widthM, lengthM])

  // Tính toán diện tích & thể tích realtime
  const calcArea = Math.round((Number(lengthM) || 1) * (Number(widthM) || 1) * 10) / 10
  const calcVolume = Math.round((Number(lengthM) || 1) * (Number(widthM) || 1) * (Number(heightM) || 1) * 10) / 10

  // Realtime Validation
  const errors = useMemo(() => {
    const list: string[] = []
    const errMap: Record<string, string> = {}

    const cleanCode = sizeCode.trim().toUpperCase()
    if (!cleanCode) {
      errMap.sizeCode = lang === 'vi' ? 'Mã cỡ kho là bắt buộc' : 'Size code is required'
      list.push(errMap.sizeCode)
    } else if (existingSpecs.some((s) => s.sizeCode.toUpperCase() === cleanCode)) {
      errMap.sizeCode = lang === 'vi' ? `Mã "${cleanCode}" đã tồn tại trong cơ sở` : `Code "${cleanCode}" already exists`
      list.push(errMap.sizeCode)
    }

    if (!name.trim()) {
      errMap.name = lang === 'vi' ? 'Tên hiển thị loại kho là bắt buộc' : 'Display name is required'
      list.push(errMap.name)
    }

    if (lengthM < 1) {
      errMap.lengthM = lang === 'vi' ? 'Chiều dài phải ≥ 1m' : 'Length must be ≥ 1m'
      list.push(errMap.lengthM)
    }
    if (widthM < 1) {
      errMap.widthM = lang === 'vi' ? 'Chiều rộng phải ≥ 1m' : 'Width must be ≥ 1m'
      list.push(errMap.widthM)
    }
    if (heightM < 1) {
      errMap.heightM = lang === 'vi' ? 'Chiều cao kho phải ≥ 1m' : 'Height must be ≥ 1m'
      list.push(errMap.heightM)
    }

    if (laneWidthM < vehicleStandard.minLaneM || laneWidthM < vehicleStandard.doorWidthM) {
      errMap.laneWidthM = lang === 'vi'
        ? `Rộng lối xe tối thiểu phải ≥ ${vehicleStandard.minLaneM}m`
        : `Lane width must be ≥ ${vehicleStandard.minLaneM}m`
      list.push(errMap.laneWidthM)
    }

    if (frameHeightM > heightM) {
      errMap.frameHeightM = lang === 'vi'
        ? `Chiều cao khung (${frameHeightM}m) không được vượt quá chiều cao kho (${heightM}m)`
        : `Frame height cannot exceed storage height`
      list.push(errMap.frameHeightM)
    }

    if (maxLoadKg < 100) {
      errMap.maxLoadKg = lang === 'vi' ? 'Tải trọng tối đa phải ≥ 100 kg' : 'Max load must be ≥ 100 kg'
      list.push(errMap.maxLoadKg)
    }

    if (monthlyPrice <= 0) {
      errMap.monthlyPrice = lang === 'vi' ? 'Đơn giá thuê phải > 0' : 'Rate must be > 0'
      list.push(errMap.monthlyPrice)
    }

    return { list, errMap, isValid: list.length === 0 }
  }, [
    sizeCode,
    name,
    lengthM,
    widthM,
    heightM,
    laneWidthM,
    frameHeightM,
    maxLoadKg,
    monthlyPrice,
    existingSpecs,
    vehicleStandard,
    lang,
  ])

  // Cập nhật giá thuê
  const handlePriceChange = (valStr: string) => {
    setPriceInputText(valStr)
    const num = parseInt(valStr.replace(/\D/g, ''), 10) || 0
    setMonthlyPrice(num)
  }

  // Submit
  const handleConfirm = () => {
    if (!errors.isValid) return

    const cleanCode = sizeCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
    const cleanName = name.trim() || `Kho ${cleanCode}`

    const newSpec: FacilityCustomUnitSpec = {
      sizeCode: cleanCode,
      name: cleanName,
      lengthM: Math.max(1, Number(lengthM) || 1),
      widthM: Math.max(1, Number(widthM) || 1),
      heightM: Math.max(1, Number(heightM) || 1),
      laneWidthM: Math.max(vehicleStandard.minLaneM, Number(laneWidthM) || vehicleStandard.minLaneM),
      maxLoadKg: Math.max(100, Number(maxLoadKg) || 100),
      monthlyPrice: Math.max(0, monthlyPrice),
      count: Math.max(0, Math.floor(Number(count) || 0)),
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      floor: Number(floor) || 1,
      zone: zone.trim() || 'Khu A',
      frameCount: Math.max(0, Math.floor(Number(frameCount) || 0)),
      frameDimensions: {
        lengthM: Math.max(0.1, Number(frameLengthM) || 1),
        widthM: Math.max(0.1, Number(frameWidthM) || 1),
        heightM: Math.max(0.1, Number(frameHeightM) || 1),
        depthM: Math.max(0.1, Number(frameLengthM) || 1),
      },
    }

    onConfirm(newSpec)
    onClose()
  }

  // Danh sách giá tham khảo từ các cỡ hiện có
  const referencePrices = useMemo(() => {
    const list: { code: string; price: number }[] = []
    existingSpecs.forEach((s) => {
      if (s.monthlyPrice > 0 && !list.some((item) => item.price === s.monthlyPrice)) {
        list.push({ code: s.sizeCode, price: s.monthlyPrice })
      }
    })
    return list.slice(0, 4)
  }, [existingSpecs])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lang === 'vi' ? 'Thêm Cỡ Kho Tùy Biến Vào Cơ Sở' : 'Add Custom Unit Type'}
      size="2xl"
      className="max-w-[95vw] xl:max-w-5xl"
    >
      <div className="space-y-4">
        {/* Banner hướng dẫn */}
        <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
            i
          </div>
          <div className="leading-relaxed">
            {lang === 'vi'
              ? 'Định nghĩa loại kho mới (XXL, MINI, PALLET...) với kích thước 3 chiều tùy biến. Diện tích, thể tích và chuẩn lối xe lưu thông sẽ được hệ thống kiểm định tự động theo thời gian thực.'
              : 'Define a new unit type with custom Length, Width, Height, and rack frame specifications. The system automatically validates vehicle access standards.'}
          </div>
        </div>

        {/* ─── Grid 2 Cột: Form 3 Nhóm bên trái + Panel Xem Trước bên phải ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* CỘT TRÁI: 3 NHÓM NHẬP LIỆU (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* ─── NHÓM 1: NHẬN DIỆN ─── */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-white font-bold text-[11px] flex items-center justify-center">
                  1
                </span>
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  {lang === 'vi' ? 'Nhận Diện Loại Kho' : 'Identification'}
                </h5>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mã cỡ kho */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Mã cỡ kho *' : 'Size Code *'}
                  </label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold uppercase bg-white focus:outline-none focus:ring-1 ${
                      errors.errMap.sizeCode
                        ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                        : 'border-stone-300 text-stone-900 focus:ring-amber-500'
                    }`}
                    placeholder="VD: XXL, MINI, PALLET"
                    value={sizeCode}
                    onChange={(e) => setSizeCode(e.target.value.toUpperCase())}
                  />
                  {errors.errMap.sizeCode ? (
                    <p className="text-[10px] font-semibold text-red-600 mt-1">{errors.errMap.sizeCode}</p>
                  ) : (
                    <p className="text-[10px] text-stone-400 mt-0.5">Viết hoa, không dấu (VD: XXL)</p>
                  )}
                </div>

                {/* Tên hiển thị loại kho */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tên hiển thị loại kho *' : 'Display Name *'}
                  </label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs font-semibold bg-white focus:outline-none focus:ring-1 ${
                      errors.errMap.name
                        ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                        : 'border-stone-300 text-stone-900 focus:ring-amber-500'
                    }`}
                    placeholder="VD: Kho Ngoại Khổ (XXL)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.errMap.name && (
                    <p className="text-[10px] font-semibold text-red-600 mt-1">{errors.errMap.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ─── NHÓM 2: KÍCH THƯỚC & TẢI TRỌNG ─── */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-white font-bold text-[11px] flex items-center justify-center">
                  2
                </span>
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  {lang === 'vi' ? 'Kích Thước, Khung Kệ & Tải Trọng' : 'Dimensions & Frame Specs'}
                </h5>
              </div>

              {/* 3 Chiều Kho: D × R × C */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                  {lang === 'vi' ? 'Kích thước gian kho (Dài × Rộng × Cao) *' : 'Storage Dimensions (L × W × H) *'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Dài */}
                  <div>
                    <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-2xs">
                      <span className="px-2 py-1 text-[10px] font-bold text-stone-500 bg-stone-100 border-r border-stone-200">
                        D
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        className="w-full px-2 py-1 text-xs font-bold text-center bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={lengthM}
                        onChange={(e) => setLengthM(parseFloat(e.target.value) || 0)}
                      />
                      <span className="pr-2 text-[10px] text-stone-400 font-mono">m</span>
                    </div>
                    {errors.errMap.lengthM && <p className="text-[9px] text-red-600 mt-0.5">{errors.errMap.lengthM}</p>}
                  </div>

                  {/* Rộng */}
                  <div>
                    <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-2xs">
                      <span className="px-2 py-1 text-[10px] font-bold text-stone-500 bg-stone-100 border-r border-stone-200">
                        R
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        className="w-full px-2 py-1 text-xs font-bold text-center bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={widthM}
                        onChange={(e) => setWidthM(parseFloat(e.target.value) || 0)}
                      />
                      <span className="pr-2 text-[10px] text-stone-400 font-mono">m</span>
                    </div>
                    {errors.errMap.widthM && <p className="text-[9px] text-red-600 mt-0.5">{errors.errMap.widthM}</p>}
                  </div>

                  {/* Cao */}
                  <div>
                    <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-2xs">
                      <span className="px-2 py-1 text-[10px] font-bold text-stone-500 bg-stone-100 border-r border-stone-200">
                        C
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        className="w-full px-2 py-1 text-xs font-bold text-center bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={heightM}
                        onChange={(e) => setHeightM(parseFloat(e.target.value) || 0)}
                      />
                      <span className="pr-2 text-[10px] text-stone-400 font-mono">m</span>
                    </div>
                    {errors.errMap.heightM && <p className="text-[9px] text-red-600 mt-0.5">{errors.errMap.heightM}</p>}
                  </div>
                </div>
              </div>

              {/* Khung kệ D × R × C & Số khung */}
              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-blue-900">
                    {lang === 'vi' ? 'Khung Kệ (Dài × Rộng × Cao & Số Khung)' : 'Rack Frame Specs'}
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-medium">
                    Đơn vị: mét (m)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {/* Dài khung */}
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-800 mb-0.5">Dài khung</label>
                    <div className="flex items-center bg-white border border-blue-200 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="w-full px-1.5 py-1 text-xs font-bold text-center text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={frameLengthM}
                        onChange={(e) => setFrameLengthM(parseFloat(e.target.value) || 0.1)}
                      />
                      <span className="pr-1 text-[9px] text-blue-600 font-mono">m</span>
                    </div>
                  </div>

                  {/* Rộng khung */}
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-800 mb-0.5">Rộng khung</label>
                    <div className="flex items-center bg-white border border-blue-200 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="w-full px-1.5 py-1 text-xs font-bold text-center text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={frameWidthM}
                        onChange={(e) => setFrameWidthM(parseFloat(e.target.value) || 0.1)}
                      />
                      <span className="pr-1 text-[9px] text-blue-600 font-mono">m</span>
                    </div>
                  </div>

                  {/* Cao khung */}
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-800 mb-0.5">Cao khung</label>
                    <div className={`flex items-center bg-white border rounded-lg overflow-hidden ${
                      errors.errMap.frameHeightM ? 'border-red-400 ring-1 ring-red-300' : 'border-blue-200'
                    }`}>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="w-full px-1.5 py-1 text-xs font-bold text-center text-blue-950 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={frameHeightM}
                        onChange={(e) => setFrameHeightM(parseFloat(e.target.value) || 0.1)}
                      />
                      <span className="pr-1 text-[9px] text-blue-600 font-mono">m</span>
                    </div>
                  </div>

                  {/* Số khung */}
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-700 mb-0.5">Số khung</label>
                    <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full px-1.5 py-1 text-xs font-bold text-center text-stone-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={frameCount}
                        onChange={(e) => setFrameCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      />
                      <span className="pr-1 text-[9px] text-stone-500 font-mono">khung</span>
                    </div>
                  </div>
                </div>

                {errors.errMap.frameHeightM && (
                  <p className="text-[10px] font-semibold text-red-600">{errors.errMap.frameHeightM}</p>
                )}
              </div>

              {/* Rộng lối xe (m) & Tải trọng tối đa (kg) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Rộng lối xe */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700">
                      {lang === 'vi' ? 'Rộng lối xe (m) *' : 'Access Lane Width (m) *'}
                    </label>
                    <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      Tối thiểu: ≥ {vehicleStandard.minLaneM}m
                    </span>
                  </div>
                  <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-2xs">
                    <input
                      type="number"
                      step={0.1}
                      min={vehicleStandard.minLaneM}
                      className={`w-full px-3 py-1.5 text-xs font-bold bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        errors.errMap.laneWidthM ? 'text-red-900 bg-red-50' : 'text-stone-900'
                      }`}
                      value={laneWidthM}
                      onChange={(e) => setLaneWidthM(parseFloat(e.target.value) || 0)}
                    />
                    <span className="px-2 text-xs font-bold text-stone-500 bg-stone-100 border-l border-stone-200">
                      m
                    </span>
                  </div>
                  {errors.errMap.laneWidthM ? (
                    <p className="text-[10px] font-semibold text-red-600 mt-1">{errors.errMap.laneWidthM}</p>
                  ) : (
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      Cửa kho: {vehicleStandard.doorWidthM}m · {vehicleStandard.vehicleType}
                    </p>
                  )}
                </div>

                {/* Tải trọng tối đa */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tải trọng tối đa (kg) *' : 'Max Load (kg) *'}
                  </label>
                  <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-2xs">
                    <input
                      type="number"
                      step={50}
                      min={100}
                      className="w-full px-3 py-1.5 text-xs font-bold text-right bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={maxLoadKg}
                      onChange={(e) => setMaxLoadKg(parseInt(e.target.value, 10) || 100)}
                    />
                    <span className="px-2 text-xs font-bold text-stone-500 bg-stone-100 border-l border-stone-200">
                      kg
                    </span>
                  </div>
                  {errors.errMap.maxLoadKg && (
                    <p className="text-[10px] font-semibold text-red-600 mt-1">{errors.errMap.maxLoadKg}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ─── NHÓM 3: THƯƠNG MẠI ─── */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-white font-bold text-[11px] flex items-center justify-center">
                  3
                </span>
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  {lang === 'vi' ? 'Thương Mại & Vị Trí' : 'Commercial & Location'}
                </h5>
              </div>

              {/* Đơn giá thuê / tháng */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    {lang === 'vi' ? 'Đơn giá thuê / tháng *' : 'Monthly Rate *'}
                  </label>
                  {referencePrices.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-stone-500">
                      <span>Gợi ý:</span>
                      {referencePrices.map((ref) => (
                        <button
                          key={ref.code}
                          type="button"
                          onClick={() => {
                            setMonthlyPrice(ref.price)
                            setPriceInputText(`${ref.price.toLocaleString('vi-VN')} ₫`)
                          }}
                          className="px-1.5 py-0.2 rounded bg-stone-200 hover:bg-stone-300 text-stone-800 text-[10px] font-semibold transition cursor-pointer"
                        >
                          {ref.code}: {ref.price.toLocaleString('vi-VN')}đ
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="VD: 28.000.000 ₫"
                  value={priceInputText}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  onBlur={() => {
                    if (monthlyPrice > 0) {
                      setPriceInputText(`${monthlyPrice.toLocaleString('vi-VN')} ₫`)
                    }
                  }}
                />
                {errors.errMap.monthlyPrice && (
                  <p className="text-[10px] font-semibold text-red-600 mt-1">{errors.errMap.monthlyPrice}</p>
                )}
              </div>

              {/* Số lượng, Tầng, Khu */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Số lượng ban đầu' : 'Initial Qty'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={count}
                    onChange={(e) => setCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tầng' : 'Floor'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={floor}
                    onChange={(e) => setFloor(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Khu vực' : 'Zone'}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="VD: Khu A"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: PANEL "XEM TRƯỚC" REALTIME (4 cols) */}
          <div className="lg:col-span-4 bg-gradient-to-b from-stone-50 to-stone-100/70 p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3.5 sticky top-2">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {lang === 'vi' ? 'Xem Trước Thông Số' : 'Live Preview'}
              </h5>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-800">
                {sizeCode || 'MÃ CỠ'}
              </span>
            </div>

            {/* Chỉ báo PASS/FAIL chuẩn lối xe */}
            <div>
              {laneWidthM >= vehicleStandard.minLaneM && laneWidthM >= vehicleStandard.doorWidthM ? (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>✓ ĐẠT CHUẨN LỐI XE LƯU THÔNG</span>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>✕ CHƯA ĐẠT (Cần tối thiểu {vehicleStandard.minLaneM}m)</span>
                </div>
              )}
            </div>

            {/* Thông số kỹ thuật tính toán */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Diện tích sàn:</span>
                <span className="font-bold text-stone-900 font-mono text-sm">{calcArea} m²</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Thể tích lưu trữ:</span>
                <span className="font-bold text-emerald-800 font-mono text-sm">{calcVolume} m³</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Tải trọng tối đa:</span>
                <span className="font-bold text-stone-900 font-mono text-sm">{maxLoadKg.toLocaleString('vi-VN')} kg</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Phương tiện tiếp cận:</span>
                <span className="font-semibold text-stone-800 text-right text-[11px]">{vehicleStandard.vehicleType}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Kích thước cửa kho:</span>
                <span className="font-bold text-stone-800 font-mono">{vehicleStandard.doorWidthM} m</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Quy mô khung kệ:</span>
                <span className="font-bold text-blue-900 font-mono">
                  {frameCount} khung ({frameLengthM}×{frameWidthM}×{frameHeightM}m)
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-stone-500 font-medium">Đơn giá định mức:</span>
                <span className="font-black text-amber-900 font-mono text-base">
                  {formatVNDCurrency(monthlyPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer Sticky của Modal ─── */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 bg-white/95 backdrop-blur-xs px-6 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-10">
          <div className="text-xs text-stone-500">
            {!errors.isValid && (
              <span className="text-red-600 font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {errors.list.join(', ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-300 transition cursor-pointer"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={!errors.isValid}
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>{lang === 'vi' ? 'Thêm Loại Kho' : 'Add Unit Type'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
