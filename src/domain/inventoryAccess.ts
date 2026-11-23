export function canOpenInventory(status: string | null | undefined, appointmentAt?: string | null) {
  if (status === 'completed') return true
  return status === 'setup_completed' && Boolean(appointmentAt && Number.isFinite(Date.parse(appointmentAt)))
}
