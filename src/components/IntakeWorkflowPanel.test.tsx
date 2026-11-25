import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import IntakeWorkflowPanel from './IntakeWorkflowPanel'

vi.mock('../services/apiClient', () => ({
  apiRequest: vi.fn(() => new Promise(() => {})),
}))

it('renders safely before state resolves', () => {
  const html = renderToStaticMarkup(
    <IntakeWorkflowPanel reservationId="res-1" role="CUSTOMER" />,
  )
  expect(html).toBe('')
})
