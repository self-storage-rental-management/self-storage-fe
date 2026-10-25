import { useId, useState } from 'react'

export default function SupportChannelInfo({ channel }: { channel: 'assistant' | 'staff' }) {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()
  const assistant = channel === 'assistant'
  return <div className="relative flex shrink-0 items-center self-center"
    onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
    onKeyDown={event => { if (event.key === 'Escape' && visible) { event.stopPropagation(); setVisible(false) } }}>
    <button type="button" aria-label={assistant ? 'Lưu ý khi dùng trợ lý AI' : 'Thông tin hỗ trợ nhân viên'}
      aria-describedby={visible ? tooltipId : undefined}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)} onClick={() => setVisible(true)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[#527a5e] transition-colors hover:bg-[#f5e5e3] hover:text-[#335b44] focus-visible:outline-2 focus-visible:outline-[#659c7c]">
      <svg aria-hidden="true" className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></svg>
    </button>
    {visible && <div id={tooltipId} role="tooltip" className="absolute -right-20 top-full z-50 w-72 max-w-[calc(100vw-64px)] pt-2">
      <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-600 shadow-lg shadow-stone-900/10">
        <p className="mb-1 font-semibold text-stone-800">{assistant ? 'Lưu ý về trợ lý AI' : 'Trao đổi với nhân viên'}</p>
        <p>{assistant
          ? 'Câu hỏi phổ biến được trả lời từ hướng dẫn có sẵn. Câu hỏi khác và lịch sử gần đây được gửi tới Gemini. Không gửi mật khẩu, mã truy cập, OTP hay thông tin thẻ.'
          : 'Cuộc trò chuyện chuyển từ AI, gồm nội dung trợ lý trước đó, được lưu và tự xóa sau 10 ngày kể từ tin nhắn cuối cùng. Tin nhắn mới từ khách hoặc nhân viên sẽ tính lại thời hạn. AI ngừng trả lời khi chuyển sang nhân viên. Không gửi mật khẩu, mã truy cập hoặc OTP.'}</p>
      </div>
    </div>}
  </div>
}
