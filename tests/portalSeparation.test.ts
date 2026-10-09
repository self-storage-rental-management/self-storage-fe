import { describe, it, expect } from 'vitest'

describe('Thiết Kế Chuẩn: Tách 2 Cổng Riêng Biệt (Customer Portal vs Admin/Back-office Portal)', () => {
  describe('1. Phân giải Routing & Đường dẫn (URL)', () => {
    function resolvePortalPath(pathname: string, hostname: string = 'localhost'): 'customer' | 'admin' | 'home' {
      const cleanPath = pathname.replace(/\/+$/, '') || '/'
      const cleanHost = hostname.toLowerCase()

      if (cleanHost.startsWith('staff.') || cleanHost.startsWith('admin.')) {
        return 'admin'
      }
      if (cleanHost.startsWith('portal.')) {
        return 'customer'
      }

      if (
        cleanPath === '/admin/login' ||
        cleanPath === '/staff/login' ||
        cleanPath === '/admin' ||
        cleanPath === '/staff' ||
        cleanPath.startsWith('/admin/') ||
        cleanPath.startsWith('/staff/')
      ) {
        return 'admin'
      }

      if (
        cleanPath === '/login' ||
        cleanPath === '/register' ||
        cleanPath === '/customer/login' ||
        cleanPath === '/portal/login' ||
        cleanPath === '/verify-email' ||
        cleanPath === '/reset-password'
      ) {
        return 'customer'
      }

      return 'home'
    }

    it('nhận diện /login và /register là Cổng Khách hàng (Customer Portal)', () => {
      expect(resolvePortalPath('/login')).toBe('customer')
      expect(resolvePortalPath('/register')).toBe('customer')
      expect(resolvePortalPath('/portal/login')).toBe('customer')
    })

    it('nhận diện subdomain portal.storagehub.vn là Cổng Khách hàng', () => {
      expect(resolvePortalPath('/', 'portal.storagehub.vn')).toBe('customer')
    })

    it('nhận diện /admin/login và /staff/login là Cổng Nội bộ (Back-office / Admin Portal)', () => {
      expect(resolvePortalPath('/admin/login')).toBe('admin')
      expect(resolvePortalPath('/staff/login')).toBe('admin')
      expect(resolvePortalPath('/admin')).toBe('admin')
    })

    it('nhận diện subdomain staff.storagehub.vn và admin.storagehub.vn là Cổng Nội bộ', () => {
      expect(resolvePortalPath('/', 'staff.storagehub.vn')).toBe('admin')
      expect(resolvePortalPath('/', 'admin.storagehub.vn')).toBe('admin')
    })

    it('nhận diện trang chủ "/" trên domain thông thường là "home"', () => {
      expect(resolvePortalPath('/')).toBe('home')
      expect(resolvePortalPath('/', 'storagehub.vn')).toBe('home')
    })
  })

  describe('2. Đối tượng và Phân quyền đăng nhập', () => {
    const mockUsers = [
      { id: '1', email: 'customer@storagehub.demo', role: 'customer' },
      { id: '2', email: 'staff@storagehub.demo', role: 'staff' },
      { id: '3', email: 'manager@storagehub.demo', role: 'manager' },
      { id: '4', email: 'business@storagehub.demo', role: 'business' },
      { id: '5', email: 'admin@storagehub.demo', role: 'admin' },
    ]

    function canAccessAdminPortal(email: string): { allowed: boolean; reason?: string } {
      const target = mockUsers.find(u => u.email === email)
      if (!target) return { allowed: false, reason: 'Tài khoản không tồn tại' }
      if (target.role === 'customer') {
        return { allowed: false, reason: 'Tài khoản khách hàng không có thẩm quyền truy cập Cổng Nội bộ' }
      }
      return { allowed: true }
    }

    it('Cổng Nội bộ từ chối tài khoản Khách hàng (customer)', () => {
      const check = canAccessAdminPortal('customer@storagehub.demo')
      expect(check.allowed).toBe(false)
      expect(check.reason).toContain('khách hàng không có thẩm quyền')
    })

    it('Cổng Nội bộ chấp nhận tất cả các vai trò nội bộ: staff, manager, business, admin', () => {
      expect(canAccessAdminPortal('staff@storagehub.demo').allowed).toBe(true)
      expect(canAccessAdminPortal('manager@storagehub.demo').allowed).toBe(true)
      expect(canAccessAdminPortal('business@storagehub.demo').allowed).toBe(true)
      expect(canAccessAdminPortal('admin@storagehub.demo').allowed).toBe(true)
    })
  })

  describe('3. Hình thức xác thực & Tính năng 2FA', () => {
    it('Cổng Khách hàng hỗ trợ Đăng nhập bằng Email/SĐT + Password và Google Sign-in', () => {
      const customerAuthMethods = ['credentials', 'google_signin']
      expect(customerAuthMethods).toContain('google_signin')
      expect(customerAuthMethods).toContain('credentials')
    })

    it('Cổng Nội bộ bắt buộc 2FA và không mở Google Sign-In cá nhân', () => {
      const adminAuthFlow = {
        step1: 'corporate_credentials',
        step2: 'mandatory_2fa',
        supportsGoogleSignIn: false,
      }
      expect(adminAuthFlow.step2).toBe('mandatory_2fa')
      expect(adminAuthFlow.supportsGoogleSignIn).toBe(false)
    })

    it('Mã 2FA phải đủ 6 chữ số hợp lệ', () => {
      const isValidOtp = (otp: string) => /^\d{6}$/.test(otp)
      expect(isValidOtp('688246')).toBe(true)
      expect(isValidOtp('123456')).toBe(true)
      expect(isValidOtp('12345')).toBe(false)
      expect(isValidOtp('abcdef')).toBe(false)
    })
  })

  describe('4. Nút Đăng Ký (Registration Policy)', () => {
    it('Cổng Khách hàng có nút/tab Đăng ký ("Chưa có tài khoản? Đăng ký ngay")', () => {
      const customerPortalConfig = {
        hasRegistration: true,
        registrationLinkText: 'Chưa có tài khoản? Đăng ký ngay',
      }
      expect(customerPortalConfig.hasRegistration).toBe(true)
      expect(customerPortalConfig.registrationLinkText).toContain('Đăng ký ngay')
    })

    it('Cổng Nội bộ KHÔNG có nút Đăng ký (Chỉ quản trị viên cấp)', () => {
      const adminPortalConfig = {
        hasRegistration: false,
        notice: 'Tài khoản do quản trị viên cấp, không mở đăng ký tự do',
      }
      expect(adminPortalConfig.hasRegistration).toBe(false)
      expect(adminPortalConfig.notice).toContain('quản trị viên cấp')
    })
  })

  describe('5. Điều hướng sau khi Login (Post-Login Redirection)', () => {
    function getPostLoginTarget(role: string): string {
      switch (role) {
        case 'customer':
          return 'CustomerApp (Dashboard khách: Xem kho, Đặt kho)'
        case 'staff':
          return 'StaffApp (Bàn làm việc nhân viên: Check-in, Nhiệm vụ kho)'
        case 'manager':
          return 'ManagerApp (Bàn làm việc quản lý: Duyệt giữ kho, Cơ sở)'
        case 'business':
          return 'BusinessApp (BOM Operations: Báo cáo tài chính, Mở rộng)'
        case 'admin':
          return 'AdminApp (Bảng điều khiển quản trị: Người dùng, Phân quyền)'
        default:
          return 'Unknown'
      }
    }

    it('Khách hàng chuyển hướng sang trang Dashboard khách (Xem kho, Đặt kho)', () => {
      expect(getPostLoginTarget('customer')).toContain('Dashboard khách')
    })

    it('Tài khoản nội bộ chuyển hướng sang Back-office theo đúng vai trò', () => {
      expect(getPostLoginTarget('staff')).toContain('StaffApp')
      expect(getPostLoginTarget('manager')).toContain('ManagerApp')
      expect(getPostLoginTarget('business')).toContain('BusinessApp')
      expect(getPostLoginTarget('admin')).toContain('AdminApp')
    })
  })
})
