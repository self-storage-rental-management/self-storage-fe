import { lazy, Suspense, useEffect, useState } from 'react'
import type { User } from './types'
import { StorageHubProvider, useStorageHub } from './store/StorageHubContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './views/Login'
import AdminPortalLogin from './views/auth/AdminPortalLogin'
import HomePage from './views/home/HomePage'
import RequiredPasswordChange from './views/RequiredPasswordChange'
import { actorToUser, getAuthenticatedActor, logoutFromApi, refreshApiSession, type ApiActor } from './services/authApi'
import { clearAuthTokens, getRefreshToken } from './services/apiClient'

const CHUNK_RELOAD_KEY = 'storagehub:chunk-reload'

const lazyWithChunkRecovery = (loader: () => Promise<any>) => lazy(async () => {
  try {
    const module = await loader()
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    return module
  } catch (error) {
    const currentLocation = `${window.location.pathname}${window.location.search}`
    const retriedLocation = sessionStorage.getItem(CHUNK_RELOAD_KEY)
    if (retriedLocation !== currentLocation) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, currentLocation)
      window.location.reload()
      return new Promise(() => {})
    }
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    throw error
  }
})

const CustomerApp = lazyWithChunkRecovery(() => import('./views/customer/CustomerApp'))
const StaffApp = lazyWithChunkRecovery(() => import('./views/staff/StaffApp'))
const ManagerApp = lazyWithChunkRecovery(() => import('./views/manager/ManagerApp'))
const BusinessApp = lazyWithChunkRecovery(() => import('./views/business/BusinessApp'))
const AdminApp = lazyWithChunkRecovery(() => import('./views/admin/AdminApp'))

type GuestView = 'home' | 'login' | 'register' | 'admin-login'

function normalizedPathname() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

function resolveGuestView(): GuestView {
  const url = new URL(window.location.href)
  const pathname = normalizedPathname()
  const hostname = window.location.hostname.toLowerCase()

  // 1. Subdomain matching: staff.storagehub.vn or admin.storagehub.vn
  if (hostname.startsWith('staff.') || hostname.startsWith('admin.')) {
    return 'admin-login'
  }
  // Subdomain matching: portal.storagehub.vn
  if (hostname.startsWith('portal.')) {
    if (pathname === '/register') return 'register'
    return 'login'
  }

  // 2. Back-office / Admin routes: /admin/login, /staff/login, /admin, /staff
  if (
    pathname === '/admin/login'
    || pathname === '/staff/login'
    || pathname === '/admin'
    || pathname === '/staff'
    || pathname.startsWith('/admin/')
    || pathname.startsWith('/staff/')
  ) {
    return 'admin-login'
  }

  // 3. Customer Portal routes
  if (pathname === '/register') return 'register'
  if (
    pathname === '/login'
    || pathname === '/customer/login'
    || pathname === '/portal/login'
    || pathname === '/verify-email'
    || pathname === '/reset-password'
    || pathname === '/profile'
    || pathname === '/profile/security'
    || url.searchParams.has('verifyEmail')
    || url.searchParams.has('resetPassword')
  ) {
    return 'login'
  }

  return 'home'
}

function navigateGuest(pathname: string, view: GuestView, setGuestView: (view: GuestView) => void) {
  window.history.pushState({ view }, '', pathname)
  setGuestView(view)
}

function MainContent() {
  const { users, sessions, startSession, endSession } = useStorageHub()
  // Keep only the session identity in memory. The role is always resolved
  // from the canonical user record in StorageHubContext, never from storage,
  // query parameters, or a form payload.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [apiActor, setApiActor] = useState<ApiActor | null>(() => getAuthenticatedActor())
  const [restoringSession, setRestoringSession] = useState(() => Boolean(getRefreshToken()))
  const [guestView, setGuestView] = useState<GuestView>(resolveGuestView)

  useEffect(() => {
    if (!getRefreshToken()) {
      setRestoringSession(false)
      return
    }
    let cancelled = false
    void refreshApiSession()
      .then(actor => {
        if (!cancelled) setApiActor(actor)
      })
      .catch(() => {
        clearAuthTokens()
        if (!cancelled) setApiActor(null)
      })
      .finally(() => {
        if (!cancelled) setRestoringSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const canonicalRecord = sessionUserId ? users.find(item => item.id === sessionUserId) : null
  const accountStatus = canonicalRecord && 'status' in canonicalRecord ? String(canonicalRecord.status) : 'active'
  const user: User | null = apiActor && apiActor.status === 'ACTIVE'
    ? actorToUser(apiActor)
    : canonicalRecord && accountStatus === 'active'
      ? {
          id: canonicalRecord.id,
          name: canonicalRecord.name,
          email: canonicalRecord.email,
          phone: canonicalRecord.phone,
          permanentAddress: canonicalRecord.permanentAddress,
          emergencyContactName: canonicalRecord.emergencyContactName,
          emergencyContactPhone: canonicalRecord.emergencyContactPhone,
          avatar: canonicalRecord.avatar,
          role: canonicalRecord.role as User['role'],
          facility: canonicalRecord.facility,
          facilityId: canonicalRecord.facilityId,
          mustChangePassword: canonicalRecord.mustChangePassword,
        }
      : null

  useEffect(() => {
    if (!sessionUserId || sessionId) return
    const canonical = users.find(item => item.id === sessionUserId)
    if (!canonical || canonical.status !== 'active') return
    const nextSessionId = startSession({
      id: canonical.id,
      name: canonical.name,
      email: canonical.email,
      phone: canonical.phone,
      role: canonical.role as User['role'],
      facility: canonical.facility
    })
    setSessionId(nextSessionId)
  }, [sessionId, sessionUserId, startSession, users])

  useEffect(() => {
    if (!sessionId || !sessionUserId) return
    const currentSession = sessions.find(item => item.id === sessionId && item.userId === sessionUserId)
    if (!currentSession || currentSession.status !== 'active') {
      setSessionUserId(null)
      setSessionId(null)
      setGuestView('home')
    }
  }, [sessionId, sessionUserId, sessions])

  useEffect(() => {
    if (user) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('page')) return
    url.searchParams.delete('page')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [user])

  useEffect(() => {
    const syncUpdatedActor = () => setApiActor(getAuthenticatedActor())
    window.addEventListener('storagehub:actor-updated', syncUpdatedActor)
    return () => window.removeEventListener('storagehub:actor-updated', syncUpdatedActor)
  }, [])

  useEffect(() => {
    if (user) return
    const syncGuestRoute = () => setGuestView(resolveGuestView())
    window.addEventListener('popstate', syncGuestRoute)
    return () => window.removeEventListener('popstate', syncGuestRoute)
  }, [user])

  const handleLogin = (nextUser: User) => {
    if (['/login', '/register', '/admin/login', '/staff/login', '/admin', '/staff', '/verify-email', '/reset-password', '/profile', '/profile/security'].includes(normalizedPathname())) {
      window.history.replaceState(null, '', '/')
    }
    const authenticatedActor = getAuthenticatedActor()
    if (authenticatedActor) {
      setApiActor(authenticatedActor)
      setSessionUserId(null)
      setSessionId(null)
      return
    }
    setApiActor(null)
    setSessionUserId(nextUser.id)
  }

  const handleLogout = () => {
    if (apiActor) void logoutFromApi()
    if (user && sessionId) endSession(sessionId, user)
    setApiActor(null)
    setSessionUserId(null)
    setSessionId(null)
    setGuestView('home')
    window.history.replaceState(null, '', '/')
  }

  if (restoringSession) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm font-medium text-stone-600">Đang khôi phục phiên đăng nhập…</div>
  }

  if (!user) {
    if (guestView === 'home') {
      return (
        <HomePage
          onOpenLogin={() => navigateGuest('/login', 'login', setGuestView)}
          onOpenRegister={() => navigateGuest('/register', 'register', setGuestView)}
          onOpenAdminLogin={() => navigateGuest('/admin/login', 'admin-login', setGuestView)}
        />
      )
    }

    if (guestView === 'admin-login') {
      return (
        <AdminPortalLogin
          onLogin={handleLogin}
          onBackToHome={() => navigateGuest('/', 'home', setGuestView)}
          onSwitchToCustomerPortal={() => navigateGuest('/login', 'login', setGuestView)}
        />
      )
    }

    return (
      <Login
        onLogin={handleLogin}
        initialTab={guestView === 'register' ? 'register' : 'login'}
        onBackToHome={() => navigateGuest('/', 'home', setGuestView)}
        onSwitchToAdminPortal={() => navigateGuest('/admin/login', 'admin-login', setGuestView)}
      />
    )
  }

  if (apiActor?.mustChangePassword) {
    return <RequiredPasswordChange actor={apiActor} onChanged={setApiActor} onLogout={handleLogout} />
  }

  const roleApp = (() => {
    switch (user.role) {
      case 'customer': return <CustomerApp user={user} onLogout={handleLogout} onUpdateUser={() => setApiActor(getAuthenticatedActor())} />
      case 'staff': return <StaffApp user={user} onLogout={handleLogout} />
      case 'manager': return <ManagerApp user={user} onLogout={handleLogout} />
      case 'business': return <BusinessApp user={user} onLogout={handleLogout} />
      case 'admin': return <AdminApp user={user} onLogout={handleLogout} />
    }
  })()

  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm font-medium text-stone-600">Đang tải không gian làm việc…</div>}>{roleApp}</Suspense>
}

export default function App() {
  return (
    <ErrorBoundary>
      <StorageHubProvider>
        <MainContent />
      </StorageHubProvider>
    </ErrorBoundary>
  )
}
