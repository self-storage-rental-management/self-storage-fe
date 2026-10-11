import type { ApiActor } from "../../services/authApi"

type FacilityActor = Pick<ApiActor, "facilityScopes"> | null

// Never turn a missing or ambiguous assignment into an all-facilities query.
export function singleManagerFacility(actor: FacilityActor) {
  const ids = Object.entries(actor?.facilityScopes ?? {})
    .filter(([, level]) => ["READ", "OPERATE", "MANAGE"].includes(level))
    .map(([id]) => id)
  return ids.length === 1 ? ids[0] : undefined
}

export function managerFacilityNotice(actor: FacilityActor) {
  const count = Object.values(actor?.facilityScopes ?? {})
    .filter((level) => ["READ", "OPERATE", "MANAGE"].includes(level)).length
  return count > 1
    ? "Tài khoản đang được gán nhiều cơ sở. Vui lòng liên hệ quản trị viên để xác nhận cơ sở phụ trách."
    : "Tài khoản chưa được phân công cơ sở."
}
