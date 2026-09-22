import { lazy, Suspense, useState } from 'react'
import type { User } from './types'
import { StorageHubProvider, useStorageHub } from './store/StorageHubContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './views/Login'

const CustomerApp = lazy(() => import('./views/customer/CustomerApp'))
const StaffApp = lazy(() => import('./views/staff/StaffApp'))
const ManagerApp = lazy(() => import('./views/manager/ManagerApp'))
const BusinessApp = lazy(() => import('./views/business/BusinessApp'))
const AdminApp = lazy(() => import('./views/admin/AdminApp'))

function MainContent() {
  const { users } = useStorageHub()
  // Keep only the session identity in memory. The role is always resolved
  // from the canonical user record in StorageHubContext, never from storage,
  // query parameters, or a form payload.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const canonicalRecord = sessionUserId ? users.find(item => item.id === sessionUserId) : null
  const accountStatus = canonicalRecord && 'status' in canonicalRecord ? String(canonicalRecord.status) : 'active'
  const user: User | null = canonicalRecord && accountStatus !== 'suspended'
    ? {
        id: canonicalRecord.id,
        name: canonicalRecord.name,
        email: canonicalRecord.email,
        role: canonicalRecord.role as User['role'],
        facility: canonicalRecord.facility,
        facilityId: canonicalRecord.facilityId
      }
    : null
  const handleLogin = (nextUser: User) => {
    setSessionUserId(nextUser.id)
  }

  const handleLogout = () => {
    setSessionUserId(null)
    history.replaceState(null, '', window.location.pathname)
  }

  if (!user) return <Login onLogin={handleLogin} />

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


