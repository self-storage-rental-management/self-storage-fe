import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { renewal } from "../../../tests/rentalApiFixtures"
import { ApiClientError } from "../../services/apiClient"
import RenewalDetail from "./RenewalDetail"
import { Button } from "../../components/ui"

const h=vi.hoisted(()=>({slots:[] as any[],cursor:0,effects:[] as (()=>void)[],create:vi.fn(),read:vi.fn(),operations:vi.fn(),assign:vi.fn(),refresh:vi.fn()}))
vi.mock("react",async original=>({...await original<typeof import("react")>(),
  useState:(initial:any)=>{const i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return [h.slots[i],(v:any)=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v}]},
  useRef:(initial:any)=>{const i=h.cursor++;return h.slots[i]??={current:initial}},
  useEffect:(fn:()=>void,deps:any[])=>{const i=h.cursor++;if(!h.slots[i]||deps.some((v,j)=>v!==h.slots[i][j])){h.slots[i]=deps;h.effects.push(fn)}},
}))
vi.mock("../../services/renewalApi",async original=>({...await original<typeof import("../../services/renewalApi")>(),
  createRenewalVnpayPaymentIntent:(...args:any[])=>h.create(...args),getRenewalVnpayPayment:(...args:any[])=>h.read(...args),
}))
vi.mock("../../services/renewalOperationsApi",async original=>({...await original<typeof import("../../services/renewalOperationsApi")>(),getRenewalOperations:(...args:any[])=>h.operations(...args)}))
vi.mock("../../services/authApi",()=>({getAuthenticatedActor:()=>({userId:"c1",roles:["CUSTOMER"]})}))
vi.mock("../manager/managerPresentation",()=>({useManagerPresentation:()=>({manager:false,copy:(v:string)=>v,explain:(v:string)=>v})}))
const record={...renewal,status:"accepted" as const,disabledReasons:[]}
const payment={paymentId:"p1",renewalId:"n1",acceptedRevisionId:"revision-1",transactionReference:"intent-1",amount:100,currency:"VND",paymentStatus:"PENDING",paymentDeadline:"2026-10-13T00:00:00Z",paidAt:null,reconciliationRequired:false,message:"Pending",paymentUrl:"https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=intent-1&vnp_Amount=10000"}
function nodes(n:any):any[]{return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==="object"&&"type" in n?[n,...nodes(n.props.children)]:[]}
function render(r=record,effects=false){h.cursor=0;h.effects=[];const view=RenewalDetail({renewal:r,role:"customer",onAction:vi.fn(),onPaymentChange:h.refresh});if(effects)h.effects.forEach(fn=>fn());return view}
function pay(view:any){return nodes(view).find(n=>n.type===Button&&["Thanh toán toàn kỳ","Đang mở VNPay","Tiếp tục thanh toán"].includes(n.props.children))}
beforeEach(async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));h.slots=[];h.create.mockReset().mockResolvedValue(payment);h.read.mockReset().mockRejectedValue(new ApiClientError("Not found",{status:404}));h.operations.mockReset().mockResolvedValue({appointmentRef:'appointment-1',appointmentStart:'2026-10-09T03:00:00Z'});h.assign.mockReset();h.refresh.mockReset();
  vi.stubGlobal("window",{location:{assign:h.assign}});
  vi.stubGlobal("document",{visibilityState:"visible"});
  const store=new Map<string,string>();vi.stubGlobal("sessionStorage",{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)});
  render(record,true);await vi.advanceTimersByTimeAsync(0);
})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals()})
it("clicks the actual payment button, binds Renewal, shows loading and blocks rapid double submission",async()=>{
  let resolve!:(v:any)=>void;h.create.mockImplementation(()=>new Promise(r=>{resolve=r}));
  const click=pay(render()).props.onClick;const first=click();await click();await vi.advanceTimersByTimeAsync(0);
  expect(h.create).toHaveBeenCalledTimes(1);expect(h.create.mock.calls[0][0]).toBe("n1");
  expect(h.create.mock.calls[0][1]).toBeTruthy();expect(pay(render()).props.disabled).toBe(true);
  resolve(payment);await first;expect(h.assign).toHaveBeenCalledWith(payment.paymentUrl);expect(pay(render()).props.disabled).toBe(false);
})
it("blocks rent prepayment until a valid signing appointment has been saved",async()=>{
  vi.clearAllTimers();h.slots=[];h.operations.mockResolvedValue({appointmentRef:null,appointmentStart:null});
  render(record,true);await vi.advanceTimersByTimeAsync(0);
  expect(pay(render()).props.disabled).toBe(true);
  expect(h.create).not.toHaveBeenCalled();
})
it("keeps the same idempotency key on uncertain retries",async()=>{
  h.create.mockRejectedValueOnce(new ApiClientError("network",{code:"NETWORK_ERROR"}));await pay(render()).props.onClick();
  const key=h.create.mock.calls[0][1];expect(JSON.stringify(render())).toContain("lỗi kết nối");
  await pay(render()).props.onClick();expect(h.create.mock.calls[1][1]).toBe(key);expect(h.assign).toHaveBeenCalledTimes(1);
})
it.each([null,"javascript:alert(1)","https://sandbox.vnpayment.vn.evil.example/paymentv2/vpcpay.html","https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=other&vnp_Amount=10000"])("shows missing/unsafe URL errors without redirecting: %s",async url=>{
  h.create.mockResolvedValue({...payment,paymentUrl:url});await pay(render()).props.onClick();
  expect(h.assign).not.toHaveBeenCalled();expect(nodes(render()).some(n=>n.props.role==="alert")).toBe(true);expect(pay(render()).props.disabled).toBe(false);
})
it.each([
  [new ApiClientError("DEFERRED_SOURCE: signing",{status:409}),"chưa đủ dữ liệu"],
  [new ApiClientError("expired",{status:401}),"đăng nhập lại"],
  [new ApiClientError("revision changed",{status:409}),"cập nhật hồ sơ"],
  [new ApiClientError("An unexpected error occurred",{status:500}),"Hệ thống gặp lỗi"],
])("surfaces actionable backend errors and resets loading",async(error,text)=>{
  h.create.mockRejectedValue(error);await pay(render()).props.onClick();expect(JSON.stringify(render())).toContain(text);expect(pay(render()).props.disabled).toBe(false);
})
it("does not render the removed requote button",()=>{
  expect(JSON.stringify(render())).not.toContain("Lấy báo giá và xác nhận lại")
})
it("reads authoritative payment on return and refreshes Renewal when settlement changes",async()=>{
  vi.clearAllTimers();h.slots=[];h.read.mockClear();
  h.read.mockResolvedValueOnce({...payment,paymentStatus:"PAID",settlementStage:"VERIFIED_AWAITING_ALLOCATION",paymentUrl:null,reconciliationRequired:true})
    .mockResolvedValue({...payment,paymentStatus:"PAID",settlementStage:"AWAITING_SIGNING",paymentUrl:null,reconciliationRequired:false});
  render(record,true);await vi.advanceTimersByTimeAsync(0);expect(h.read).toHaveBeenCalledWith("n1");
  expect(JSON.stringify(render())).toContain("Đang cập nhật khoản thanh toán vào hồ sơ");expect(pay(render()).props.disabled).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);expect(h.refresh).toHaveBeenCalledTimes(2);expect(JSON.stringify(render())).toContain("Tiếp theo: đến cơ sở hoàn tất ký");
})
it("refreshes the invoice when a refund changes only the transaction projection",async()=>{
  vi.clearAllTimers();h.slots=[];h.read.mockClear();h.refresh.mockClear();
  const paid={...payment,paymentStatus:"PAID",settlementStage:"AWAITING_SIGNING",paymentUrl:null,reconciliationRequired:false,receiptAvailable:true};
  h.read.mockResolvedValueOnce({...paid,transactionStatus:"SUCCEEDED"}).mockResolvedValue({...paid,transactionStatus:"PARTIALLY_REFUNDED"});
  render(record,true);await vi.advanceTimersByTimeAsync(0);
  expect(h.refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.refresh).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(render())).toContain("Đã hoàn tiền một phần");
});
it("does not redirect from a stale intent response after switching Renewal",async()=>{
  let resolve!:(v:any)=>void;h.create.mockImplementation(()=>new Promise(r=>{resolve=r}));const first=pay(render()).props.onClick();await vi.advanceTimersByTimeAsync(0);
  render({...record,id:"n2"});resolve(payment);await first;expect(h.assign).not.toHaveBeenCalled();
  h.create.mockResolvedValue({...payment,renewalId:"n2"});await pay(render({...record,id:"n2"})).props.onClick();
  expect(h.create.mock.calls[1][0]).toBe("n2");expect(h.create.mock.calls[1][1]).not.toBe(h.create.mock.calls[0][1]);
})
it("shows received funds without redirecting when retry returns PAID",async()=>{
  h.create.mockResolvedValue({...payment,paymentStatus:"PAID",paymentUrl:null,reconciliationRequired:true});await pay(render()).props.onClick();
  expect(h.assign).not.toHaveBeenCalled();expect(JSON.stringify(render())).toContain("Chờ đối soát");
})
it("keeps the paid amount and receipt in the compact payment block without a payment deadline",async()=>{
  h.create.mockResolvedValue({...payment,paymentStatus:"PAID",paidAt:"2026-10-08T01:27:00Z",settlementStage:"AWAITING_SIGNING",paymentUrl:null,reconciliationRequired:false});
  await pay(render()).props.onClick();
  const block=nodes(render()).find(n=>n.type==="section"&&n.props["aria-label"]==="Thanh toán gia hạn");
  expect(block).toBeDefined();
  const view=JSON.stringify(block);
  expect(view).toContain("Thanh toán thành công");
  expect(view).toContain("100 đ");
  expect(view).toContain("Thanh toán lúc");
  expect(view).toContain("Xem biên lai");
  expect(view).toContain("Tiếp theo: đến cơ sở hoàn tất ký");
  expect(view).not.toContain("Hạn thanh toán");
});
