export interface TicketMessage {
  id: string
  sender: string
  role: 'customer' | 'staff' | 'system'
  time: string
  text: string
}

export interface TicketItem {
  id: string
  customer: string
  email: string
  phone?: string
  subject: string
  category: string
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'waiting-customer' | 'resolved'
  created: string
  facility: string
  facilityId?: string
  unit: string
  assignedStaff?: string
  assignedStaffInitials?: string
  updatedAt?: string
  relatedType?: 'rental' | 'reservation' | 'general'
  relatedId?: string
  messages: TicketMessage[]
  source?: 'ai_assistant' | 'direct' | 'escalation'
  aiSummary?: string
  estimatedWaitTime?: string
  emergencyEscalation?: boolean
  impact?: 'high' | 'medium' | 'low'
  feedbackRating?: 'helpful' | 'unhelpful'
  feedbackComment?: string
}
