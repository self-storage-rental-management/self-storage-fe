# Renewal payment UI - 12/10/2026

The customer workspace remains `page=rental-records` / **Hồ sơ Thuê**. RenewalDetail's **Thanh toán toàn kỳ** button calls the shared backend Payment endpoint, not simulated deposit commands.

## Diagnosed code defects

- Previous handler silently did nothing when the response had `paymentUrl=null`. It did not report missing/unsafe URLs.
- `paymentBusy` state alone did not synchronously lock rapid clicks before rerender.
- An unscoped key ref could retain another Renewal/revision's key if the component identity changed.
- Payment read required a preexisting deadline/full-rent status, missing accepted requests without readiness and some return/late/terminal states.
- Operations validator still required deposit proof in signing phases, rejecting the actual no-deposit full-rent response; it also rejected `AWAITING_PAYMENT_INTENT` and `FULL_RENT_PAYMENT` history.

These are confirmed source/controlled-handler defects. No authenticated live gateway network trace was captured, so an individual local click's exact backend refusal must not be inferred from these findings. Backend payment readiness can legitimately return DEFERRED_SOURCE when real financial/hold/calendar sources or opt-in integrations are unavailable.

## Fixed control flow

`RenewalDetail → useRenewalPayment.pay → createRenewalVnpayPaymentIntent → apiRequest → POST /api/customer/renewals/{id}/payment-intents → ApiResponse.data → validated VNPay URL → location.assign`.

Ref lock prevents double submission; loading resets on failure. Session key is scoped to customer, Renewal and accepted revision and is preserved for uncertain retries. Another selected Renewal cannot receive a stale response/redirect. Backend recovers the same owned current intent if browser storage was lost. Authorization and 401 token refresh stay in the existing apiClient; the original Idempotency-Key is reused after refresh. Client sends no amount/currency/purpose.

Redirect only accepts HTTPS VNPay host, expected payment path, no credentials/alternate port and exact transaction reference/amount matching the authoritative response. Missing/invalid URL shows an error. PAID replay shows received funds without opening a second payment. DEFERRED_SOURCE, conflict, expired session and network errors have actionable messages.

On `vnpayReturn=true&renewalId=…`, existing route restoration opens the corresponding detail. The hook fetches `GET …/payment` immediately and polls while a visible detail is open. Payment transitions refresh authoritative Renewal. `status=success` from redirect is not trusted as evidence. Successful payment distinguishes verified-awaiting-allocation, allocated-awaiting-signing, awaiting-signing, completed and reconciliation-required. Only BE completion proves extension.

API base URL remains the user's local configuration. Existing API unit tests hardcode port 8080; full-suite verification therefore used `VITE_API_BASE_URL=http://localhost:8080` in the test process, leaving `.env` unchanged.

## Verification scope

Controlled actual-button tests cover ID/header/loading/duplicate click/retry key/URL/error/session/stale response/authoritative refresh. API tests use actual apiClient with mocked HTTP responses and token refresh. These are not browser-to-gateway E2E. Runtime requires deployed BE schema, configured gateway and authoritative financial/policy/hold/calendar/assignment/evidence integrations. No optional runtime flags were automatically enabled.
