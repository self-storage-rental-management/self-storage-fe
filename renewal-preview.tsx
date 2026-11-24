import React from 'react'
import { createRoot } from 'react-dom/client'
import { RenewalOperationsSummary } from './src/views/rental-api/RenewalOperationsPanel'
import './src/index.css'

type State = React.ComponentProps<typeof RenewalOperationsSummary>['state']
const step = Number(new URLSearchParams(location.search).get('step') || 2)
const date = '2026-11-25T10:00:00+07:00'
const state = {
  phase: step < 3 ? 'AWAITING_PAYMENT_INTENT' : step < 6 ? 'SIGNING' : 'COMPLETED',
  appointmentRef: step >= 2 ? 'demo' : null, appointmentStart: date,
  depositPaidAt: step >= 3 ? date : null, arrivalRef: step >= 4 ? 'demo' : null,
  fullRentPaidAt: step >= 5 ? date : null, completedAt: step >= 6 ? date : null,
  effectiveSigningDeadline: date, recoveryCutoff: date, missingSources: [],
} as State
createRoot(document.getElementById('root')!).render(
  <main className="min-h-screen bg-stone-100 p-8">
    <div className="mx-auto max-w-4xl space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <h1 className="text-lg font-bold">Xử lý ký gia hạn – Nhân viên</h1>
      <RenewalOperationsSummary state={state} role="staff" />
    </div>
  </main>,
)
