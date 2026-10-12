import { expect, it } from "vitest"
import { isOperationState, isOperationEvent } from "./renewalOperationsApi"
import { signingState, ids } from "../../tests/rentalOperationsApiFixtures"
it("accepts full-period payment signing state without inventing a deposit",()=>{
  const full={...signingState,depositPaymentRef:null,depositPaidAt:null,fullRentPaymentRef:ids.file,fullRentPaidAt:signingState.depositPaidAt}
  expect(isOperationState(full)).toBe(true)
  expect(isOperationState({...full,fullRentPaidAt:null})).toBe(false)
  expect(isOperationState({...full,phase:"AWAITING_PAYMENT_INTENT",fullRentPaymentRef:null,fullRentPaidAt:null})).toBe(true)
})
it("accepts resource-bound full-rent history and rejects missing receipt evidence",()=>{
  const event={id:ids.file,kind:"FULL_RENT_PAYMENT",occurredAt:signingState.depositPaidAt,actorId:null,
    data:{paymentRef:ids.file,amount:100,currency:"VND",paidAt:signingState.depositPaidAt,paymentDeadline:signingState.originalSigningDeadline,receiptId:ids.file}}
  expect(isOperationEvent(event)).toBe(true)
  expect(isOperationEvent({...event,data:{...event.data,receiptId:null}})).toBe(false)
})
