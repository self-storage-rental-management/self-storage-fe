import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { clearAuthTokens, setAccessToken, setRefreshToken } from "./apiClient"
import { createRenewalVnpayPaymentIntent, getRenewalVnpayPayment } from "./renewalApi"
const data={paymentId:"p1",renewalId:"n1",acceptedRevisionId:"r1",transactionReference:"t1",amount:100,currency:"VND",paymentStatus:"PENDING",paymentDeadline:"2026-10-13T00:00:00Z",paidAt:null,reconciliationRequired:false,message:"Pending",paymentUrl:null,invoiceNumber:null,invoiceStatus:"DRAFT",invoiceIssuedAt:null,settlementStage:"AWAITING_PAYMENT"}
const fetchMock=vi.fn()
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}})}
beforeEach(()=>{clearAuthTokens();setAccessToken("test-only-access");fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock)})
afterEach(()=>{clearAuthTokens();vi.unstubAllGlobals()})
it("uses POST payment-intents with Bearer and original idempotency header, without client money",async()=>{
  fetchMock.mockResolvedValue(response({data}));await expect(createRenewalVnpayPaymentIntent("n1","retry-key")).resolves.toEqual(data);
  const [url,options]=fetchMock.mock.calls[0];expect(url).toMatch(/\/api\/customer\/renewals\/n1\/payment-intents$/);expect(options.method).toBe("POST");
  expect(options.headers.get("Authorization")).toBe("Bearer test-only-access");expect(options.headers.get("Idempotency-Key")).toBe("retry-key");expect(options.body).toBeUndefined();
})
it("reads GET authoritative payment and rejects wrong Renewal or response envelope",async()=>{
  fetchMock.mockResolvedValueOnce(response({data}));await getRenewalVnpayPayment("n1");expect(fetchMock.mock.calls[0][0]).toMatch(/\/renewals\/n1\/payment$/);
  fetchMock.mockResolvedValueOnce(response({data:{...data,renewalId:"other"}}));await expect(getRenewalVnpayPayment("n1")).rejects.toThrow();
  fetchMock.mockResolvedValueOnce(response(data));await expect(getRenewalVnpayPayment("n1")).rejects.toThrow();
})
it("refreshes tokens and retries the same intent header after a 401",async()=>{
  setRefreshToken("test-only-refresh");fetchMock.mockResolvedValueOnce(response({error:{code:"UNAUTHORIZED",message:"Expired"}},401))
    .mockResolvedValueOnce(response({data:{accessToken:"new-access",refreshToken:"new-refresh"}})).mockResolvedValueOnce(response({data}));
  await createRenewalVnpayPaymentIntent("n1","original-key");expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1].headers.get("Idempotency-Key")).toBe("original-key");expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new-access");
})
it("surfaces session expiration when refresh fails",async()=>{
  setRefreshToken("test-only-refresh");fetchMock.mockResolvedValue(response({error:{code:"UNAUTHORIZED",message:"Expired"}},401));
  await expect(createRenewalVnpayPaymentIntent("n1","key")).rejects.toMatchObject({status:401,code:"UNAUTHORIZED"});expect(fetchMock).toHaveBeenCalledTimes(2);
})
