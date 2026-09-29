import { useState, useRef, useEffect } from 'react'
import type { User } from '../../types'
import { useStorageHub } from '../../store/StorageHubContext'
import {
  SUPPORT_FAQS,
  matchQueryAgainstFAQ,
  assignStaffWithWorkloadAndUrgency,
  resolveCustomerStorageContext,
  saveBotFeedback,
  type FAQItem
} from '../../services/supportBotService'

interface Message {
  id: string
  sender: 'bot' | 'user' | 'system'
  text: string
  time: string
  isFaqAnswer?: boolean
  faqItem?: FAQItem
  isEscalationNotice?: boolean
  isEmergencyAlert?: boolean
}

interface CustomerSupportChatbotProps {
  user: User
  isOpen?: boolean
  onToggleOpen?: (open: boolean) => void
  onOpenTicketList?: () => void
  showToast: (msg: string) => void
}

export default function CustomerSupportChatbot({
  user,
  isOpen: propsIsOpen,
  onToggleOpen,
  onOpenTicketList,
  showToast
}: CustomerSupportChatbotProps) {
  const { tickets, rentals, holds, createSupportTicket } = useStorageHub()

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = propsIsOpen !== undefined ? propsIsOpen : internalIsOpen
  const setIsOpen = (val: boolean) => {
    if (onToggleOpen) onToggleOpen(val)
    setInternalIsOpen(val)
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [lastQuestion, setLastQuestion] = useState<string | null>(null)
  const [lastFaqItem, setLastFaqItem] = useState<FAQItem | null>(null)
  const [showPostActions, setShowPostActions] = useState(false)
  const [showFeedbackStep, setShowFeedbackStep] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState(false)

  // Requirement 1: Infinite loop breaker
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [showLoopBreakerPrompt, setShowLoopBreakerPrompt] = useState(false)

  // Requirement 6: Selected unit context
  const storageContext = resolveCustomerStorageContext(user, rentals, holds)
  const [selectedUnit, setSelectedUnit] = useState(storageContext.unit)
  const [selectedFacility, setSelectedFacility] = useState(storageContext.facility)
  const [selectedFacilityId, setSelectedFacilityId] = useState(storageContext.facilityId)

  // Auto-scroll
  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, showPostActions, showLoopBreakerPrompt, showFeedbackStep, user.name])

  // Add the welcome message in one place so opening the panel cannot duplicate it.
  useEffect(() => {
    if (!isOpen) return
    setMessages(prev => {
      if (prev.length > 0) return prev
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      return [{
        id: 'msg-welcome',
        sender: 'bot',
        time: now,
        text: `Xin chào ${user.name}! Mình là Trợ lý ảo StorageHub 🤖 Mình có thể giải đáp tức thì các thắc mắc về mã PIN, hợp đồng, thanh toán, hoặc tự động kết nối bạn với nhân viên phụ trách cơ sở.`
      }]
    })
  }, [isOpen, user.name])

  const handleOpen = () => {
    setIsOpen(true)
  }

  const addMessage = (sender: 'bot' | 'user' | 'system', text: string, extra?: Partial<Message>) => {
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sender,
        text,
        time: now,
        ...extra
      }
    ])
  }

  // Handle asking a predefined FAQ or text
  const handleAsk = (questionText: string) => {
    setShowPostActions(false)
    setShowFeedbackStep(false)
    setShowLoopBreakerPrompt(false)
    setLastQuestion(questionText)

    addMessage('user', questionText)

    // Check FAQ
    const match = matchQueryAgainstFAQ(questionText)
    setLastFaqItem(match)

    setTimeout(() => {
      if (match) {
        addMessage('bot', match.answer, { isFaqAnswer: true, faqItem: match })

        if (match.solved) {
          setTimeout(() => {
            addMessage('bot', 'Vấn đề này đã được giải quyết chưa bạn? Hãy cho trợ lý biết để hỗ trợ thêm nhé:')
            setShowPostActions(true)
          }, 350)
        } else {
          // If match is not solvable by bot (e.g. gate stuck, leak), automatically suggest escalation
          setTimeout(() => {
            addMessage('bot', '⚠️ Sự cố này cần nhân viên kỹ thuật tại cơ sở can thiệp. Bạn có muốn chuyển ngay cho nhân viên trực ca không?')
            setShowPostActions(true)
          }, 350)
        }
      } else {
        // Fallback natural language answer
        addMessage('bot', `Cảm ơn bạn đã hỏi về "${questionText}". Trợ lý đã kiểm tra hệ thống cơ sở ${selectedFacility}. Nếu nội dung này chưa có trong hướng dẫn tự động, bạn có thể chuyển yêu cầu trực tiếp cho nhân viên phụ trách để được hỗ trợ chuyên sâu nhé!`)
        setShowPostActions(true)
      }
    }, 450)
  }

  // Requirement 1: Handle "Hỏi vấn đề khác" with loop-breaker trigger
  const handleAskAnother = () => {
    setShowPostActions(false)
    setShowFeedbackStep(false)

    const nextCount = unresolvedCount + 1
    setUnresolvedCount(nextCount)

    // Requirement 1: If user clicks "Hỏi vấn đề khác" >= 2 times without reaching "Đã xong"
    if (nextCount >= 2) {
      setShowLoopBreakerPrompt(true)
      addMessage('bot', '💡 Trợ lý AI nhận thấy bạn đang gặp nhiều thắc mắc liên tiếp nhưng có thể các câu trả lời tự động chưa giải quyết được triệt để. Bạn có muốn chuyển thẳng cho nhân viên hỗ trợ trực tiếp của cơ sở luôn không?')
      return
    }

    addMessage('bot', 'Được thôi, bạn cần hỗ trợ thêm vấn đề gì nữa? Hãy chọn chủ đề hoặc gõ câu hỏi:')
  }

  // Requirement 5: Handle "Đã xong, cảm ơn" with micro-feedback collection
  const handleMarkDone = () => {
    setShowPostActions(false)
    setShowLoopBreakerPrompt(false)
    setUnresolvedCount(0)
    addMessage('bot', 'Tuyệt vời! Rất vui vì đã giúp được bạn 🙌 Nếu sau này cần gì thêm, cứ quay lại đây nhé.')
    setShowFeedbackStep(true)
  }

  const handleFeedbackRate = (rating: 'helpful' | 'unhelpful', tag?: string) => {
    setFeedbackGiven(true)
    setShowFeedbackStep(false)

    saveBotFeedback({
      faqId: lastFaqItem?.id,
      question: lastQuestion || 'Câu hỏi tự do',
      rating,
      feedbackTags: tag ? [tag] : []
    })

    if (rating === 'helpful') {
      addMessage('bot', '🌟 Cảm ơn bạn đã đánh giá! Phản hồi tích cực của bạn giúp trợ lý StorageHub hoàn thiện hơn mỗi ngày.')
    } else {
      addMessage('bot', '🙏 Cảm ơn bạn đã góp ý. Trợ lý đã ghi nhận để cải tiến chất lượng câu trả lời. Nếu vẫn cần hỗ trợ tại chỗ, bạn hãy bấm chuyển cho nhân viên bất cứ lúc nào.')
      setShowPostActions(true)
    }
  }

  // Requirements 2, 3, 4, 6: Escalation workflow
  const handleEscalate = () => {
    setShowPostActions(false)
    setShowLoopBreakerPrompt(false)
    setShowFeedbackStep(false)
    setUnresolvedCount(0)

    const questionSubject = lastQuestion || 'Yêu cầu hỗ trợ từ trợ lý AI'
    const category = lastFaqItem?.category || (
      /(cổng|pin|passcode|keypad|door|gate)/i.test(questionSubject) ? 'Access & Entry' : 'Tư vấn chung'
    )

    // Requirement 4 & 2 & 3: Smart weighted assignment
    const assignment = assignStaffWithWorkloadAndUrgency({
      category,
      questionText: questionSubject,
      facilityId: selectedFacilityId,
      currentTickets: tickets
    })

    const aiSummaryText = `Khách hỏi: "${questionSubject}". Trợ lý AI đã hướng dẫn nhưng khách cần hỗ trợ chuyên sâu.` +
      ` Tự động phân loại: [${category} - Mức độ: ${assignment.priority.toUpperCase()}].` +
      (assignment.isAllOffline
        ? ` 🚨 Tất cả nhân viên quầy đang offline. Phiếu được đánh dấu khẩn cấp để quản lý ca trực tiếp nhận.`
        : ` Đã điều phối cho ${assignment.assignedStaffName} (ETA: ${assignment.estimatedWaitLabel}).`)

    try {
      const createdTicket = createSupportTicket(
        {
          customer: user.name,
          email: user.email,
          phone: user.phone || '+84 908 123 456',
          subject: questionSubject,
          category,
          priority: assignment.priority,
          impact: assignment.priority,
          status: assignment.isAllOffline && !assignment.isUrgent ? 'open' : 'in-progress',
          facility: selectedFacility,
          facilityId: selectedFacilityId,
          unit: selectedUnit,
          assignedStaff: assignment.assignedStaffName,
          assignedStaffInitials: assignment.assignedStaffInitials,
          source: 'ai_assistant',
          aiSummary: aiSummaryText,
          estimatedWaitTime: assignment.estimatedWaitLabel,
          emergencyEscalation: assignment.isAllOffline && assignment.isUrgent,
          relatedType: storageContext.relatedType,
          relatedId: storageContext.relatedId
        },
        `Khách hàng yêu cầu hỗ trợ qua Trợ lý AI: "${questionSubject}". Gian kho: ${selectedUnit} tại ${selectedFacility}.`,
        user
      )
      const ticketId = createdTicket.id

      showToast(`Đã tạo phiếu hỗ trợ ${ticketId} thành công!`)

      // Requirement 3: If all staff are offline and urgent
      if (assignment.isAllOffline && assignment.isUrgent) {
        addMessage(
          'bot',
          `🚨 ĐÃ ĐÁNH DẤU PHIẾU KHẨN CẤP\n\n` +
          `• Mã phiếu: ${ticketId}\n` +
          `• Gian kho: ${selectedUnit} (${selectedFacility})\n` +
          `• Trạng thái: Tất cả nhân viên quầy hiện đang ngoài giờ trực. Phiếu đã được đánh dấu KHẨN CẤP và chuyển vào hàng đợi quản lý ca trực (${assignment.emergencyManagerName}).\n` +
          `• Thời gian tiếp nhận dự kiến: ${assignment.estimatedWaitLabel}`,
          { isEmergencyAlert: true }
        )
      } else if (assignment.isAllOffline) {
        addMessage(
          'bot',
          `🌙 Ngoài giờ hỗ trợ trực tiếp của quầy (08:00 - 20:00).\n\n` +
          `Yêu cầu ${ticketId} của bạn đã được lưu vào đầu hàng đợi của ca sáng mai (08:00). Bạn có thể theo dõi và bổ sung thông tin ngay trong phiếu hỗ trợ.`,
          { isEscalationNotice: true }
        )
      } else {
        // Requirement 2: Specific estimated wait time
        addMessage(
          'bot',
          `✅ Đã chuyển thành công yêu cầu ${ticketId} cho nhân viên hỗ trợ!\n\n` +
          `• Nhân viên tiếp nhận: ${assignment.assignedStaffName} (Đang trực tuyến)\n` +
          `• Cơ sở & Gian kho: ${selectedFacility} · ${selectedUnit}\n` +
          `• ⏱️ Thời gian phản hồi dự kiến: ${assignment.estimatedWaitLabel}\n` +
          `• Bạn có thể theo dõi tiến độ hoặc nhắn tin bổ sung trong mục "Hỗ trợ khách hàng".`,
          { isEscalationNotice: true }
        )
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể chuyển yêu cầu.')
    }
  }

  const handleSendInput = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    const text = inputText.trim()
    setInputText('')
    handleAsk(text)
  }

  return (
    <>
      {/* ── Floating Launcher ───────────────────────────────── */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Mở Trợ lý StorageHub"
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full bg-[#181b22] px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all duration-300 hover:bg-[#20242d] hover:scale-105 border border-amber-600/30"
          style={{ boxShadow: '0 10px 28px rgba(24, 27, 34, 0.45)' }}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span>Trợ lý StorageHub</span>
          <span className="rounded-md bg-amber-600/30 px-1.5 py-0.5 text-[10px] text-amber-300 font-mono">AI</span>
        </button>
      )}

      {/* ── Chat Panel ──────────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Trợ lý StorageHub"
          className="fixed right-4 bottom-4 z-50 flex h-[620px] max-h-[85vh] w-[390px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl transition-all duration-300"
          style={{ boxShadow: '0 20px 60px rgba(24, 27, 34, 0.35)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 bg-[#181b22] px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 font-bold text-white shadow-inner text-sm">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-white">Trợ lý StorageHub</h3>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">Trực tuyến</span>
                </div>
                <p className="text-[11px] text-stone-400">Trả lời tức thì · Chuyển nhân viên khi cần</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Đóng trợ lý"
            >
              ✕
            </button>
          </div>

          {/* Context Banner: Customer's mapped facility & unit */}
          <div className="flex items-center justify-between border-b border-stone-200 bg-[#f4f1ea] px-3.5 py-2 text-xs text-stone-700">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-amber-700 font-bold">📍 Kho:</span>
              <span className="font-semibold text-stone-900 truncate">
                {selectedUnit} · {selectedFacility}
              </span>
            </div>
            {storageContext.hasMultipleRentals && (
              <select
                value={selectedUnit}
                onChange={e => {
                  const found = storageContext.rentalsList.find(r => r.unitId === e.target.value)
                  if (found) {
                    setSelectedUnit(found.unitId)
                    setSelectedFacility(found.facilityName)
                    setSelectedFacilityId(found.facilityId)
                  }
                }}
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-800"
              >
                {storageContext.rentalsList.map(r => (
                  <option key={r.unitId} value={r.unitId}>
                    {r.unitId} ({r.facilityName.split('–')[1] || r.facilityName})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Messages Body */}
          <div role="log" aria-live="polite" aria-label="Trao đổi với Trợ lý StorageHub" className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#faf8f4]">
            {messages.map(msg => {
              const isBot = msg.sender === 'bot'
              const isUser = msg.sender === 'user'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-[#181b22] text-white rounded-br-lg'
                        : msg.isEmergencyAlert
                        ? 'bg-red-50 text-red-950 border border-red-200 font-medium'
                        : msg.isEscalationNotice
                        ? 'bg-amber-50 text-amber-950 border border-amber-200'
                        : 'bg-white text-stone-800 border border-stone-200 rounded-bl-lg'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    {msg.faqItem?.actionHint && (
                      <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <span>👉 Gợi ý: {msg.faqItem.actionHint}</span>
                      </div>
                    )}
                  </div>
                  <span className="mt-1 text-[10px] text-stone-400 px-1">{msg.time}</span>
                </div>
              )
            })}

            {/* Requirement 1: Loop Breaker Banner */}
            {showLoopBreakerPrompt && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2 shadow-sm animate-fade-in">
                <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>⚡ Gợi ý từ hệ thống:</span>
                </p>
                <p className="text-[11.5px] leading-relaxed">
                  Bạn đã hỏi một số vấn đề liên tiếp. Để không mất thời gian của bạn, bạn có thể kết nối ngay với nhân viên trực tiếp của cơ sở {selectedFacility}:
                </p>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleEscalate}
                    className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
                  >
                    ⚡ Chuyển ngay cho nhân viên hỗ trợ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoopBreakerPrompt(false)
                      setUnresolvedCount(0)
                      addMessage('bot', 'Bạn có thể chọn một chủ đề khác bên dưới hoặc gõ câu hỏi cụ thể nhé:')
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-amber-100/50 transition"
                  >
                    Tiếp tục hỏi trợ lý AI
                  </button>
                </div>
              </div>
            )}

            {/* Requirement 5: Micro-feedback step */}
            {showFeedbackStep && !feedbackGiven && (
              <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs space-y-2.5 shadow-sm">
                <p className="font-semibold text-stone-800">
                  Câu trả lời của trợ lý có giúp ích cho bạn không?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedbackRate('helpful')}
                    className="flex-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 font-bold text-emerald-800 hover:bg-emerald-100 transition flex items-center justify-center gap-1.5"
                  >
                    <span>👍</span> Hữu ích
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedbackRate('unhelpful')}
                    className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 font-bold text-stone-700 hover:bg-stone-100 transition flex items-center justify-center gap-1.5"
                  >
                    <span>👎</span> Chưa hài lòng
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick FAQ suggestions */}
          {!showPostActions && !showLoopBreakerPrompt && (
            <div className="border-t border-stone-200 bg-[#f4f1ea] p-2.5">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-stone-500 px-1">
                Chủ đề thường gặp
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {SUPPORT_FAQS.slice(0, 6).map(faq => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => handleAsk(faq.question)}
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800 transition"
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Post Actions (Resolve / Ask another / Escalate) */}
          {showPostActions && (
            <div className="border-t border-stone-200 bg-[#f4f1ea] p-3 space-y-1.5">
              <button
                type="button"
                onClick={handleMarkDone}
                className="w-full rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
              >
                ✓ Đã xong, cảm ơn
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleAskAnother}
                  className="rounded-lg border border-stone-300 bg-white py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                >
                  Hỏi vấn đề khác
                </button>
                <button
                  type="button"
                  onClick={handleEscalate}
                  className="rounded-lg bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
                >
                  Chuyển nhân viên
                </button>
              </div>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={handleSendInput}
            className="flex items-center gap-2 border-t border-stone-200 bg-white p-2.5"
          >
            <input
              type="text"
              placeholder="Nhập câu hỏi của bạn..."
              aria-label="Nhập câu hỏi hỗ trợ"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#181b22] text-white disabled:opacity-40 hover:bg-[#20242d] transition"
              aria-label="Gửi tin nhắn"
            >
              ➤
            </button>
          </form>

          {/* Quick Ticket List Jump */}
          {onOpenTicketList && (
            <div className="border-t border-stone-100 bg-stone-50 px-3 py-1.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onOpenTicketList()
                }}
                className="text-[11px] font-semibold text-amber-700 hover:underline"
              >
                Xem danh sách phiếu hỗ trợ của bạn ({tickets.filter(t => t.email === user.email || t.customer === user.name).length})
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
