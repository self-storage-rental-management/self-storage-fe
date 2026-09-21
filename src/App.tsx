import { lazy, Suspense, useState } from 'react'
import type { User } from './types'
import { LanguageProvider } from './i18n/LanguageContext'
import { StorageHubProvider } from './store/StorageHubContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './views/Login'

const CustomerApp = lazy(() => import('./views/customer/CustomerApp'))
const StaffApp = lazy(() => import('./views/staff/StaffApp'))
const ManagerApp = lazy(() => import('./views/manager/ManagerApp'))
const BusinessApp = lazy(() => import('./views/business/BusinessApp'))
const AdminApp = lazy(() => import('./views/admin/AdminApp'))

function MainContent() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('storagehub:user')
      return saved ? JSON.parse(saved) as User : null
    } catch {
      return null
    }
  })

  const handleLogin = (nextUser: User) => {
    localStorage.setItem('storagehub:user', JSON.stringify(nextUser))
    setUser(nextUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('storagehub:user')
    setUser(null)
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
      <LanguageProvider>
        <StorageHubProvider>
          <MainContent />
        </StorageHubProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}


