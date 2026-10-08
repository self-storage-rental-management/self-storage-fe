import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaymentComplaintWithdrawalConfirmation } from './CustomerPaymentComplaint'

describe('payment complaint withdrawal confirmation', () => {
  it('warns about cancellation and released capacity before withdrawal', () => {
    const html = renderToStaticMarkup(
      <PaymentComplaintWithdrawalConfirmation
        open
        busy={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(html).toContain('Rút khiếu nại sẽ hủy đơn giữ kho')
    expect(html).toContain('Suất kho hiện tại sẽ được giải phóng')
    expect(html).toContain('không được đảm bảo có thể khôi phục')
    expect(html).toContain('Giữ khiếu nại')
    expect(html).toContain('Xác nhận rút')
  })

  it('does not render the confirmation while closed', () => {
    const html = renderToStaticMarkup(
      <PaymentComplaintWithdrawalConfirmation
        open={false}
        busy={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(html).toBe('')
  })
})
