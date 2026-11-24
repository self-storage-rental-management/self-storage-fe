export interface InventoryDecision {
  outcome: 'ACCEPTED' | 'REFUSED' | 'RETURN_REQUESTED' | 'TRANSFER_REQUESTED'
  source: 'STAFF' | 'CUSTOMER'
  decidedBy: string | null
  decidedByName: string | null
  decidedAt: string | null
  note: string | null
  evidenceReferences: string[]
  returnCaseId: string | null
  returnStatus: string | null
  scheduledReturnDate: string | null
}

export const intakeDecisionLabels: Record<InventoryDecision['outcome'], string> = {
  ACCEPTED: 'Đã tiếp nhận hàng hóa',
  REFUSED: 'Đã từ chối tiếp nhận',
  RETURN_REQUESTED: 'Khách đã yêu cầu trả kho',
  TRANSFER_REQUESTED: 'Chờ thu xếp chuyển hàng',
}
