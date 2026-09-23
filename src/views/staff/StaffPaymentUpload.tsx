import StaffFileUpload from './StaffFileUpload'

export default function StaffPaymentUpload(props: { value: string; onChange: (value: string) => void; onNameChange?: (name: string) => void }) {
  return <StaffFileUpload label="Ảnh hoặc chứng từ thanh toán" {...props} />
}
