import { describe, expect, it } from 'vitest'
import {
  assessSecurityRisk,
  formatDateOnly,
  formatFullDateTime,
  formatTimeAgo,
  parseIpLocation,
  parseUserAgent,
} from '../src/views/admin/loginHistoryHelpers'
import type { AdminApiLoginHistory } from '../src/services/adminApi'

describe('loginHistoryHelpers', () => {
  describe('parseUserAgent', () => {
    it('parses Chrome on Windows 11 desktop correctly', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      const parsed = parseUserAgent(ua)
      expect(parsed.browser).toBe('Chrome')
      expect(parsed.browserVersion).toBe('126')
      expect(parsed.os).toBe('Windows 11')
      expect(parsed.deviceType).toBe('desktop')
      expect(parsed.iconType).toBe('windows')
      expect(parsed.displayShort).toContain('Chrome 126')
      expect(parsed.displayShort).toContain('Windows 11')
      expect(parsed.isAutomated).toBe(false)
    })

    it('parses Safari on iPhone mobile correctly', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      const parsed = parseUserAgent(ua)
      expect(parsed.browser).toBe('Safari')
      expect(parsed.browserVersion).toBe('17')
      expect(parsed.os).toBe('iOS 17.5')
      expect(parsed.deviceType).toBe('mobile')
      expect(parsed.iconType).toBe('apple')
      expect(parsed.isAutomated).toBe(false)
    })

    it('parses Chrome on Android mobile correctly', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
      const parsed = parseUserAgent(ua)
      expect(parsed.browser).toBe('Chrome')
      expect(parsed.os).toBe('Android 14')
      expect(parsed.deviceType).toBe('mobile')
      expect(parsed.iconType).toBe('android')
    })

    it('identifies automated script/bot clients', () => {
      const ua = 'Python-requests/2.31.0'
      const parsed = parseUserAgent(ua)
      expect(parsed.isAutomated).toBe(true)
      expect(parsed.deviceType).toBe('bot')
      expect(parsed.browser).toBe('Python Script')
    })

    it('handles empty or missing user agent gracefully', () => {
      const parsed = parseUserAgent(null)
      expect(parsed.browser).toBe('Không xác định')
      expect(parsed.isAutomated).toBe(false)
    })
  })

  describe('parseIpLocation', () => {
    it('identifies IPv6 and IPv4 localhost loopback addresses', () => {
      const parsedIpv6 = parseIpLocation('0:0:0:0:0:0:0:1')
      expect(parsedIpv6.networkType).toBe('loopback')
      expect(parsedIpv6.displayLabel).toContain('Localhost')

      const parsedIpv4 = parseIpLocation('127.0.0.1')
      expect(parsedIpv4.networkType).toBe('loopback')
    })

    it('identifies private local LAN networks', () => {
      const parsed = parseIpLocation('192.168.1.50')
      expect(parsed.networkType).toBe('lan')
      expect(parsed.displayLabel).toContain('Mạng nội bộ')
    })

    it('identifies public Vietnamese IP locations', () => {
      const parsedHcm = parseIpLocation('14.241.18.25')
      expect(parsedHcm.networkType).toBe('public')
      expect(parsedHcm.city).toBe('TP. Hồ Chí Minh')
      expect(parsedHcm.countryCode).toBe('VN')
      expect(parsedHcm.isForeign).toBe(false)
    })

    it('identifies foreign IPs and sets foreign flag', () => {
      const parsedUs = parseIpLocation('104.28.19.45')
      expect(parsedUs.isForeign).toBe(true)
      expect(parsedUs.countryCode).toBe('US')
    })
  })

  describe('assessSecurityRisk', () => {
    const baseLog: AdminApiLoginHistory = {
      id: 'log-1',
      userId: 'usr-1',
      fullName: 'Test User',
      email: 'test@example.com',
      roles: ['CUSTOMER'],
      success: true,
      ipAddress: '14.241.18.25',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
      failureReason: null,
      occurredAt: new Date().toISOString(),
    }

    it('rates legitimate successful login as safe', () => {
      const risk = assessSecurityRisk(baseLog, [baseLog])
      expect(risk.level).toBe('safe')
      expect(risk.badgeText).toBe('Thành công')
    })

    it('flags brute-force attacks with >=3 consecutive failures as high risk', () => {
      const now = Date.now()
      const failLog1: AdminApiLoginHistory = {
        ...baseLog,
        id: 'f1',
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
        occurredAt: new Date(now - 1000).toISOString(),
      }
      const failLog2: AdminApiLoginHistory = {
        ...baseLog,
        id: 'f2',
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
        occurredAt: new Date(now - 2000).toISOString(),
      }
      const failLog3: AdminApiLoginHistory = {
        ...baseLog,
        id: 'f3',
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
        occurredAt: new Date(now - 3000).toISOString(),
      }

      const all = [failLog1, failLog2, failLog3]
      const risk = assessSecurityRisk(failLog1, all)
      expect(risk.level).toBe('high')
      expect(risk.badgeText).toContain('Sai MK ≥3 lần')
      expect(risk.reasons.some(r => r.includes('Brute-force'))).toBe(true)
    })

    it('flags foreign IP logins as warning', () => {
      const foreignLog: AdminApiLoginHistory = {
        ...baseLog,
        ipAddress: '104.28.19.45',
      }
      const risk = assessSecurityRisk(foreignLog, [foreignLog])
      expect(risk.level).toBe('warning')
      expect(risk.badgeText).toBe('IP nước ngoài')
    })

    it('flags logins to locked accounts as high risk', () => {
      const lockedLog: AdminApiLoginHistory = {
        ...baseLog,
        success: false,
        failureReason: 'USER_LOCKED',
      }
      const risk = assessSecurityRisk(lockedLog, [lockedLog])
      expect(risk.level).toBe('high')
      expect(risk.reasons.some(r => r.includes('khóa'))).toBe(true)
    })
  })

  describe('date formatters', () => {
    it('formats date and time properly', () => {
      const iso = '2026-10-09T08:30:00.000Z'
      expect(formatFullDateTime(iso)).not.toBe('—')
      expect(formatDateOnly(iso)).not.toBe('—')
      expect(formatTimeAgo(iso)).toBeDefined()
    })
  })
})
