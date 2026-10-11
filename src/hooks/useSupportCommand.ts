import { useRef, useState, useSyncExternalStore } from "react"
import { ApiClientError } from "../services/apiClient"
import { createSupportTicket, sendSupportCommand } from "../services/supportApi"
import { newRenewalIdempotencyKey } from "./useRenewalCommand"
import type {
  SupportCommand,
  SupportCreate,
  SupportRole,
} from "../types/supportApi"

export type SupportSubmission = {
  kind: "create"
  body: SupportCreate
  parentId?: string
} | {
  kind: "command"
  role: SupportRole
  id: string
  command: SupportCommand
}

// Transport metadata only, in memory and keyed by API actor + role. No business/demo store.
// Keep uncertain attempts through modal/page unmount so navigation cannot mint a second key.
export class SupportAttempt {
  private unknownOutcome = false
  get uncertain() {
    return this.unknownOutcome
  }
  pending?: {
    signature: string
    key: string
    submission: SupportSubmission
  }
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.pending
  prepare(submission: SupportSubmission) {
    const signature = JSON.stringify(submission)
    if (this.pending && this.pending.signature !== signature)
      throw new Error(
        "Cần xác định kết quả thao tác trước bằng cùng yêu cầu, không gửi nội dung mới.",
      )
    if (!this.pending) {
      this.pending = {
        signature,
        key: newRenewalIdempotencyKey(),
        submission: JSON.parse(signature) as SupportSubmission,
      }
      this.listeners.forEach((listener) => listener())
    }
    return this.pending
  }
  clear(key?: string) {
    if (key && this.pending?.key !== key) return
    this.pending = undefined
    this.unknownOutcome = false
    this.listeners.forEach((listener) => listener())
  }
  reject(key: string | undefined, error: unknown) {
    if (!key || this.pending?.key !== key) return
    // Rejecting a retry is not reconciliation of the original lost response.
    this.unknownOutcome ||= uncertainSupportOutcome(error)
    if (!this.unknownOutcome) this.clear(key)
  }
}
const attempts = new Map<string, SupportAttempt>()
export function supportAttemptFor(scope: string) {
  if (!attempts.has(scope)) attempts.set(scope, new SupportAttempt())
  return attempts.get(scope)!
}
export function uncertainSupportOutcome(error: unknown) {
  return (
    !(error instanceof ApiClientError) ||
    error.status === null ||
    error.status >= 500
  )
}
export function useSupportCommand(scope: string, onSuccess: () => void) {
  const attempt = supportAttemptFor(scope)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const pending = useSyncExternalStore(
    attempt.subscribe,
    attempt.snapshot,
    attempt.snapshot,
  )
  const [error, setError] = useState<unknown>()
  const conflict =
    error instanceof ApiClientError && error.status === 409 && !attempt.uncertain
  const run = async (submission: SupportSubmission) => {
    if (lock.current || conflict) return
    const previous = attempt.pending
    if (previous && previous.signature !== JSON.stringify(submission)) {
      setError(new Error("Cần thử lại yêu cầu trước để xác định kết quả."))
      return
    }
    lock.current = true
    setBusy(true)
    setError(undefined)
    let succeeded = false
    let sentKey: string | undefined
    try {
      const saved = attempt.prepare(submission),
        input = saved.submission
      sentKey = saved.key
      if (input.kind === "create")
        await createSupportTicket(input.body, saved.key, input.parentId)
      else
        await sendSupportCommand(input.role, input.id, input.command, saved.key)
      attempt.clear(sentKey)
      succeeded = true
    } catch (e) {
      attempt.reject(sentKey, e)
      setError(e)
    } finally {
      lock.current = false
      setBusy(false)
    }
    if (succeeded) onSuccess()
  }
  return {
    run,
    busy,
    uncertain: !!pending && !busy,
    conflict,
    error,
    locked: busy || !!pending,
    retry: () => {
      if (attempt.pending) void run(attempt.pending.submission)
    },
    clearError: () => setError(undefined),
  }
}
