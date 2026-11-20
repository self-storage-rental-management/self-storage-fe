import { Button, Input, Modal } from '../../components/ui'
import type { CustomerReservation } from '../../services/customerReservationApi'

export default function CustomerReservationOtpModal(_props: {
  reservation: CustomerReservation | null
  code: string
  developmentCode?: string | null
  busy: boolean
  message: string | null
  nextResendAt: number
  now: number
  onCodeChange: (value: string) => void
  onClose: () => void
  onResend: () => void | Promise<unknown>
  onVerify: () => void | Promise<unknown>
}) {
  return null
}
