import type { CommunicationPolicyInput, RenewalPolicyInput, PolicyKind } from "../../services/duongIntegrationApi"

type Input = CommunicationPolicyInput | RenewalPolicyInput
type Pending = { input: Input; conflict: boolean }
// Session-memory only. Navigation preserves the exact pending payload; no demo/cache data source.
const pending = new Map<string, Pending>()
export function policyPendingKey(actor: string, facility: string, kind: PolicyKind) {
  return JSON.stringify([actor, facility, kind])
}
export function readPendingPolicy(key: string) { return pending.get(key) }
export function retainPendingPolicy(key: string, input: Input, conflict: boolean) {
  pending.set(key, { input: structuredClone(input), conflict })
}
export function clearPendingPolicy(key: string) { pending.delete(key) }
