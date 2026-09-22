import { lazy, Suspense, useEffect, useState } from 'react'
import type { User } from './types'
import { StorageHubProvider, useStorageHub } from './store/StorageHubContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './views/Login'
import HomePage from './views/home/HomePage'

const CustomerApp = lazy(() => import('./views/customer/CustomerApp'))
const StaffApp = lazy(() => import('./views/staff/StaffApp'))
const ManagerApp = lazy(() => import('./views/manager/ManagerApp'))
const BusinessApp = lazy(() => import('./views/business/BusinessApp'))
const AdminApp = lazy(() => import('./views/admin/AdminApp'))

function MainContent() {
  const { users, sessions, startSession, endSession } = useStorageHub()
  // Keep only the session identity in memory. The role is always resolved
  // from the canonical user record in StorageHubContext, never from storage,
  // query parameters, or a form payload.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [guestView, setGuestView] = useState<'home' | 'login' | 'register'>('home')

  const canonicalRecord = sessionUserId ? users.find(item => item.id === sessionUserId) : null
  const accountStatus = canonicalRecord && 'status' in canonicalRecord ? String(canonicalRecord.status) : 'active'
  const user: User | null = canonicalRecord && accountStatus === 'active'
    ? {
        id: canonicalRecord.id,
        name: canonicalRecord.name,
        email: canonicalRecord.email,
        phone: canonicalRecord.phone,
        role: canonicalRecord.role as User['role'],
        facility: canonicalRecord.facility,
        facilityId: canonicalRecord.facilityId
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

  const handleLogin = (nextUser: User) => {
    setSessionUserId(nextUser.id)
  }

  const handleLogout = () => {
    if (user && sessionId) endSession(sessionId, user)
    setSessionUserId(null)
    setSessionId(null)
    setGuestView('home')
    history.replaceState(null, '', window.location.pathname)
  }

  if (!user) {
    if (guestView === 'home') {
      return (
        <HomePage
          onOpenLogin={() => setGuestView('login')}
          onOpenRegister={() => setGuestView('register')}
        />
      )
    }
    return (
      <Login
        onLogin={handleLogin}
        initialTab={guestView === 'register' ? 'register' : 'login'}
        onBackToHome={() => setGuestView('home')}
      />
    )
  }

  const roleApp = (() => {
    switch (user.role) {
      case 'customer': return <CustomerApp user={user} onLogout={handleLogout} />
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
