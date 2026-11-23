import { describe, expect, it } from "vitest"
import { renewal } from "../../tests/rentalApiFixtures"
import { operationState } from "../../tests/rentalOperationsApiFixtures"
import { isRenewalRecord } from "./renewalApi"
import { isOperationState } from "./renewalOperationsApi"

describe("renewal public identity validation", () => {
  it("accepts the parent rental code and a positive safe sequence", () => {
    expect(isRenewalRecord({ ...renewal, rentalDisplayCode: "SH-184033", renewalSequence: 2 })).toBe(true)
    expect(isOperationState({ ...operationState, rentalDisplayCode: "SH-184033", renewalSequence: 2 })).toBe(true)
  })

  it("keeps older responses readable when identity fields are absent", () => {
    expect(isRenewalRecord(renewal)).toBe(true)
    expect(isOperationState(operationState)).toBe(true)
  })

  it.each([
    { rentalDisplayCode: "GH-2611-000001", renewalSequence: 1 },
    { rentalDisplayCode: "SH-12345", renewalSequence: 1 },
    { rentalDisplayCode: "SH-184033", renewalSequence: 0 },
    { rentalDisplayCode: "SH-184033", renewalSequence: 1.5 },
    { rentalDisplayCode: "SH-184033", renewalSequence: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects an invalid public identity %#", identity => {
    expect(isRenewalRecord({ ...renewal, ...identity })).toBe(false)
    expect(isOperationState({ ...operationState, ...identity })).toBe(false)
  })
})
