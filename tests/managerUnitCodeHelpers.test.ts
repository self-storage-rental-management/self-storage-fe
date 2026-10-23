import { describe, expect, it } from 'vitest'
import {
  removeVietnameseTones,
  generateUnitTypePrefix,
  generateUnitTypeCode,
  extractZonePrefix,
  extractFloorNumber,
  formatPhysicalUnitCode,
  previewPhysicalUnitCodes,
} from '../src/views/manager/managerUnitCodeHelpers'

describe('Manager Unit Code Helpers', () => {
  describe('generateUnitTypeCode (Phương án 2)', () => {
    it('generates acronym from Vietnamese name + -T01', () => {
      expect(generateUnitTypeCode('Kho Đồ Gia Đình')).toBe('KDGD-T01')
      expect(generateUnitTypeCode('Kho Mini Cá Nhân')).toBe('KMCN-T01')
      expect(generateUnitTypeCode('Kho Tiêu Chuẩn')).toBe('KTC-T01')
      expect(generateUnitTypeCode('Kho Lớn')).toBe('KL-T01')
    })

    it('handles single word by taking first 3 letters', () => {
      expect(generateUnitTypeCode('Locker')).toBe('LOC-T01')
      expect(generateUnitTypeCode('Mini')).toBe('MIN-T01')
    })

    it('auto-increments if code already exists in facility', () => {
      const existing = ['KDGD-T01', 'KTC-T01']
      expect(generateUnitTypeCode('Kho Đồ Gia Đình', existing)).toBe('KDGD-T02')
      expect(generateUnitTypeCode('Kho Tiêu Chuẩn', existing)).toBe('KTC-T02')
    })

    it('ignores current code when editing existing item', () => {
      const existing = ['KDGD-T01', 'KDGD-T02']
      expect(generateUnitTypeCode('Kho Đồ Gia Đình', existing, 'KDGD-T01')).toBe('KDGD-T01')
    })

    it('fallbacks to LK-T01 for empty string', () => {
      expect(generateUnitTypeCode('')).toBe('LK-T01')
    })
  })

  describe('formatPhysicalUnitCode & previewPhysicalUnitCodes (Cách B - Chuẩn Tòa nhà)', () => {
    it('formats as [Zone]-[Floor][Number 2 digits]', () => {
      expect(formatPhysicalUnitCode('Khu A', '1', 1)).toBe('A-101')
      expect(formatPhysicalUnitCode('Khu A', '1', 10)).toBe('A-110')
      expect(formatPhysicalUnitCode('Khu B', '2', 5)).toBe('B-205')
      expect(formatPhysicalUnitCode('Khu C', 'Tầng 3', 12)).toBe('C-312')
    })

    it('handles plain zone without "Khu" prefix', () => {
      expect(formatPhysicalUnitCode('A', '1', 2)).toBe('A-102')
      expect(formatPhysicalUnitCode('B', '4', 8)).toBe('B-408')
    })

    it('handles alphanumeric zone like Zone 1', () => {
      expect(formatPhysicalUnitCode('Zone 1', '2', 3)).toBe('1-203')
    })

    it('previews physical unit codes correctly', () => {
      expect(previewPhysicalUnitCodes('Khu A', '1', 1)).toBe('A-101')
      expect(previewPhysicalUnitCodes('Khu A', '1', 2)).toBe('A-101, A-102')
      expect(previewPhysicalUnitCodes('Khu A', '1', 10)).toBe('A-101 → A-110')
      expect(previewPhysicalUnitCodes('Khu B', '2', 5)).toBe('B-201 → B-205')
    })
  })
})
