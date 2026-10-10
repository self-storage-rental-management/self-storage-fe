import { useRef, useState } from "react"
import { ApiClientError } from "../services/apiClient"

export function newRenewalIdempotencyKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  // LAN HTTP preview can lack randomUUID (secure-context only).
  // Keep transport keys cryptographically random without inventing business IDs.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `renewal-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

export class RenewalAttempt {
  private unknownOutcome = false
  private attempt: {
    signature: string
    key: string
  } | null = null
  key(signature: string) {
    if (this.attempt && this.attempt.signature !== signature)
      throw new Error(
        "Kết quả thao tác trước chưa xác định. Cần xử lý lại cùng nội dung trước khi đổi yêu cầu.",
      )
    this.attempt ??= { signature, key: newRenewalIdempotencyKey() }
    return this.attempt.key
  }
  clear() {
    this.attempt = null
    this.unknownOutcome = false
  }
  reject(error: unknown) {
    // A later denial does not prove that the earlier uncertain transaction rolled back.
    this.unknownOutcome ||= isUncertainRenewalOutcome(error)
    if (!this.unknownOutcome) this.clear()
    return this.unknownOutcome
  }
}
export function isUncertainRenewalOutcome(error: unknown) {
  // A gateway/server failure can occur after the transaction committed.
  // Reuse the original key instead of creating a second money/coordination command.
  return (
    !(error instanceof ApiClientError) ||
    error.status === null ||
    error.status >= 500
  )
}
export function useRenewalCommand() {
  const attempt = useRef(new RenewalAttempt())
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState<unknown>()
  const conflict =
    error instanceof ApiClientError && error.status === 409 && !uncertain
  const run = async (
    signature: string,
    send: (key: string) => Promise<unknown>,
    success: () => void,
  ) => {
    if (lock.current || conflict) return
    lock.current = true
    setBusy(true)
    setError(undefined)
    try {
      await send(attempt.current.key(signature))
      attempt.current.clear()
      setUncertain(false)
    } catch (e) {
      const unknownOutcome = attempt.current.reject(e)
      setUncertain(unknownOutcome)
      setError(e)
      return
    } finally {
      lock.current = false
      setBusy(false)
    }
    success()
  }
  return { run, busy, uncertain, error, conflict }
}
