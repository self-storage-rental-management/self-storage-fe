export function canOpenInventory(status: string | null | undefined, _appointmentAt?: string | null) {
  return status === 'setup_in_progress' || status === 'setup_completed' || status === 'completed'
}
