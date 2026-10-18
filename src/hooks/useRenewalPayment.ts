import { useEffect, useRef, useState } from "react"
import { ApiClientError } from "../services/apiClient"
import { createRenewalVnpayPaymentIntent, getRenewalVnpayPayment, renewalPaymentRedirectUrl } from "../services/renewalApi"
import type { RenewalApiRecord, RenewalVnpayPaymentResponse } from "../types/renewalApi"
import { newRenewalIdempotencyKey } from "./useRenewalCommand"

import { getRenewalOperations } from "../services/renewalOperationsApi"

export function renewalPaymentError(error: unknown): string {
  if(error instanceof ApiClientError) {
    if(error.status===401)return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi tiếp tục thanh toán."
    if(error.message.includes("DEFERRED_SOURCE")||error.code==="DEFERRED_SOURCE")
      return "Hệ thống chưa đủ dữ liệu để mở thanh toán gia hạn. Vui lòng liên hệ hỗ trợ để kiểm tra hồ sơ."
    if(error.status===409)return `Chưa thể mở thanh toán: ${error.message}. Vui lòng cập nhật hồ sơ hoặc liên hệ hỗ trợ.`
    if(error.status!==null&&error.status>=500)
      return "Hệ thống gặp lỗi khi xử lý thanh toán gia hạn. Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
    if(error.status===null)return "Chưa xác định kết quả do lỗi kết nối. Hãy thử lại; hệ thống sẽ dùng lại yêu cầu thanh toán này."
  }
  return error instanceof Error?error.message:"Không thể mở thanh toán gia hạn. Vui lòng thử lại."
}

/** Both intent retries and read responses remain bound to the selected customer/revision. */
export function useRenewalPayment(renewal: RenewalApiRecord, enabled: boolean, onChange?: () => void) {
  const scope=`storagehub:renewal-payment:${renewal.customer.id}:${renewal.id}:${renewal.acceptedRevision??"unknown"}`
  const currentScope=useRef(scope);currentScope.current=scope
  const currentEnabled=useRef(enabled);currentEnabled.current=enabled
  const mounted=useRef(true)
  const lock=useRef(false)
  const attempt=useRef<{scope:string,key:string}|null>(null)
  const refresh=useRef(onChange);refresh.current=onChange
  const epoch=useRef(0)
  const lastStatus=useRef<{scope:string,signature:string}|null>(null)
  const [payment,setPayment]=useState<RenewalVnpayPaymentResponse|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [appointmentSelected,setAppointmentSelected]=useState(false)
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false}},[])
  const forget=()=>{
    attempt.current=null
    try { sessionStorage.removeItem(scope) } catch {}
  }

  useEffect(()=>{
    let active=true
    let reading=false
    setPayment(null);setError(null);setAppointmentSelected(false)
    if(lastStatus.current?.scope!==scope)lastStatus.current=null
    if(!enabled)return
    const read=async()=>{
      if(lock.current||reading)return
      reading=true
      const request=++epoch.current
      try {
        const operations=await getRenewalOperations("customer",renewal.id)
        if(!active||currentScope.current!==scope||request!==epoch.current)return
        setAppointmentSelected(!!operations.appointmentRef && !!operations.appointmentStart && Date.parse(operations.appointmentStart)>Date.now())
        const result=await getRenewalVnpayPayment(renewal.id)
        if(!active||currentScope.current!==scope||request!==epoch.current)return
        setPayment(result);setError(null)
        if(result.paymentStatus==="FAILED"||result.paymentStatus==="CANCELLED")forget()
        const signature=`${result.paymentStatus}:${result.settlementStage}:${result.reconciliationRequired}`
        const previous=lastStatus.current?.signature
        lastStatus.current={scope,signature}
        if(signature!==previous&&(previous!==undefined||result.paymentStatus==="PAID"))refresh.current?.()
      } catch(e) {
        if(!active||currentScope.current!==scope||request!==epoch.current)return
        if(e instanceof ApiClientError&&e.status===404)return
        setError(renewalPaymentError(e))
      } finally { reading=false }
    }
    void read()
    // Poll authoritative state on an open detail, including the VNPay return view.
    const timer=typeof document==="undefined"?null:globalThis.setInterval(()=>{
      if(document.visibilityState!=="hidden")void read()
    },5000)
    // Back from the gateway can restore this component from the browser cache,
    // including a suspended request and its submission lock.
    const releaseNavigation=()=>{
      ++epoch.current;lock.current=false;reading=false;setBusy(false)
    }
    const restore=()=>{releaseNavigation();void read()}
    if(typeof window!=="undefined") {
      window.addEventListener?.("pagehide",releaseNavigation)
      window.addEventListener?.("pageshow",restore)
    }
    return ()=>{
      active=false;if(timer!==null)globalThis.clearInterval(timer)
      if(typeof window!=="undefined") {
        window.removeEventListener?.("pagehide",releaseNavigation)
        window.removeEventListener?.("pageshow",restore)
      }
    }
  },[enabled,scope,renewal.id,renewal.version])

  const pay=async()=>{
    if(lock.current||!enabled||renewal.status!=="accepted"||renewal.acceptedRevision===null||payment?.paymentStatus==="PAID")return
    lock.current=true;const request=++epoch.current;setBusy(true);setError(null)
    const isCurrent=()=>mounted.current&&currentScope.current===scope&&currentEnabled.current&&request===epoch.current
    try {
      // Read the authoritative outcome before reusing a persisted retry key.
      // A cancelled/failed gateway attempt must not consume an extra click.
      try {
        const latest=await getRenewalVnpayPayment(renewal.id)
        if(!isCurrent())return
        setPayment(latest)
        if(latest.paymentStatus==="PAID") {refresh.current?.();return}
        if(latest.paymentStatus==="FAILED"||latest.paymentStatus==="CANCELLED")forget()
      } catch(e) {
        if(!isCurrent())return
        if(!(e instanceof ApiClientError&&e.status===404))throw e
      }
      const operations=await getRenewalOperations("customer",renewal.id)
      if(!isCurrent())return
      if(!operations.appointmentRef || !operations.appointmentStart || Date.parse(operations.appointmentStart)<=Date.now())
        throw new Error("Vui lòng chọn lịch ký gia hạn trước khi thanh toán.")
      if(attempt.current?.scope!==scope)attempt.current=null
      let key=attempt.current?.key
      if(!key) { try { key=sessionStorage.getItem(scope)??undefined } catch {} }
      key??=newRenewalIdempotencyKey()
      attempt.current={scope,key}
      try { sessionStorage.setItem(scope,key) } catch {}
      const result=await createRenewalVnpayPaymentIntent(renewal.id,key)
      if(!isCurrent())return
      setPayment(result);refresh.current?.()
      if(result.paymentStatus==="PAID")return
      if(result.paymentStatus==="FAILED"||result.paymentStatus==="CANCELLED") {
        forget();throw new Error("Giao dịch trước đã kết thúc. Vui lòng bấm thanh toán lại để tạo giao dịch mới.")
      }
      window.location.assign(renewalPaymentRedirectUrl(result))
    } catch(e) {
      if(isCurrent())setError(renewalPaymentError(e))
    } finally { if(request===epoch.current){lock.current=false;if(mounted.current)setBusy(false)} }
  }
  return {payment,busy,error,pay,appointmentSelected}
}
