import { apiRequest } from './apiClient'

export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'

export interface SupportTicketMessage {
  id: string
  authorId: string
  authorName: string
  customerMessage: boolean
  body: string
  createdAt: string
}

export interface CustomerSupportTicket {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  facilityId: string | null
  facilityName: string | null
  assignedToId: string | null
  assignedToName: string | null
  status: SupportTicketStatus
  subject: string
  description: string
  messages: SupportTicketMessage[]
  createdAt: string
  updatedAt: string
}

interface CustomerSupportTicketPage {
  data: CustomerSupportTicket[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    sort: string
  }
  correlationId: string
}

interface ApiEnvelope<T> {
  data: T
  correlationId: string
}

export async function listCustomerSupportTickets(status?: SupportTicketStatus, page = 0, size = 100) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (status) params.set('status', status)
  return apiRequest<CustomerSupportTicketPage>(`/api/customer/support-tickets?${params.toString()}`)
}

export async function createCustomerSupportTicket(input: {
  subject: string
  description: string
  facilityId?: string
}) {
  return apiRequest<ApiEnvelope<CustomerSupportTicket>>('/api/customer/support-tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function addCustomerSupportMessage(ticketId: string, body: string) {
  return apiRequest<ApiEnvelope<CustomerSupportTicket>>(`/api/customer/support-tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}
