import { useId, useState } from 'react'

export default function SupportChannelInfo({ channel }: { channel: 'assistant' | 'staff' }) {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()
  const assistant = channel === 'assistant'
  return <div className="relative ml-auto flex items-center self-center"
    onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
    onKeyDown={event => { if (event.key === 'Escape' && visible) { event.stopPropagation(); setVisible(false) } }}>
    <button type="button" aria-label={assistant ? 'Lưu ý khi dùng trợ lý AI' : 'Thông tin hỗ trợ nhân viên'}
      aria-describedby={visible ? tooltipId : undefined}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)} onClick={() => setVisible(true)}
      className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-amber-600">
      <svg aria-hidden="true" className="show-icon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></svg>
    </button>
    {visible && <div id={tooltipId} role="tooltip" className="absolute right-0 top-full z-50 w-72 max-w-[calc(100vw-64px)] pt-2">
      <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-600 shadow-lg shadow-stone-900/10">
        <p className="mb-1 font-semibold text-stone-800">{assistant ? 'Lưu ý về trợ lý AI' : 'Trao đổi với nhân viên'}</p>
        <p>{assistant
          ? 'Câu hỏi phổ biến được trả lời từ hướng dẫn có sẵn. Câu hỏi khác và lịch sử gần đây được gửi tới Gemini. Không gửi mật khẩu, mã truy cập, OTP hay thông tin thẻ.'
          : 'Gửi câu hỏi về đặt kho, hồ sơ thuê hoặc vấn đề tại cơ sở. Chọn Cuộc trò chuyện mới và xác nhận cơ sở hoặc hồ sơ liên quan để nhân viên tiếp nhận.'}</p>
      </div>
    </div>}
  </div>
}
