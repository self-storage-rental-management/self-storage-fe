import type { User } from '../../types'
import AdminShell from './AdminShell'

export default function AdminApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <AdminShell user={user} onLogout={onLogout} />
}
