import { userFacingError } from '../presentation/userFacingError'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { User } from '../types'

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface ProfileHeaderCardProps {
  user: Pick<User, 'name' | 'email' | 'id' | 'role'> & { avatarUrl?: string | null }
  roleLabel: string
  roleColor?: string
  canChangeAvatar?: boolean
  avatarUploading?: boolean
  onAvatarChange: (file: File) => Promise<void>
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(-2).map(part => part[0]).join('').toUpperCase() || '?'
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6.75A1.75 1.75 0 014.75 5h14.5A1.75 1.75 0 0121 6.75v10.5A1.75 1.75 0 0119.25 19H4.75A1.75 1.75 0 013 17.25V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7l7.03 5.02a1.7 1.7 0 001.94 0L20 7" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8.5A1.5 1.5 0 015.5 7h2.08a1.5 1.5 0 001.34-.83l.34-.67A1.5 1.5 0 0110.6 5h2.8a1.5 1.5 0 011.34.83l.34.67a1.5 1.5 0 001.34.83h2.08A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z" />
      <circle cx="12" cy="13" r="3.25" strokeWidth={1.8} />
    </svg>
  )
}

function CopyIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12.5l4 4L19 7" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect width="10" height="10" x="9" y="9" rx="1.5" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 15H5.75A1.75 1.75 0 014 13.25v-7.5A1.75 1.75 0 015.75 4h7.5A1.75 1.75 0 0115 5.75V6" />
    </svg>
  )
}

export default function ProfileHeaderCard({
  user,
  roleLabel,
  roleColor = 'bg-blue-100 text-blue-700',
  canChangeAvatar = true,
  avatarUploading = false,
  onAvatarChange,
}: ProfileHeaderCardProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const avatarUrl = user.avatarUrl || ''
  const displayUserId = user.id.slice(0, 12).toUpperCase()

  useEffect(() => {
    if (!successMessage) return
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  useEffect(() => {
    if (!copied) return
    const timeoutId = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timeoutId)
  }, [copied])

  const openFilePicker = () => {
    if (!canChangeAvatar || avatarUploading) return
    avatarInputRef.current?.click()
  }

  const handleAvatarKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFilePicker()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadError(null)
    setSuccessMessage(null)
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setUploadError('Định dạng ảnh không hợp lệ. Chọn JPG, PNG hoặc WEBP.')
      return
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setUploadError('Ảnh vượt quá 5 MB. Chọn ảnh nhỏ hơn.')
      return
    }

    try {
      await onAvatarChange(file)
      setSuccessMessage('Đã cập nhật ảnh đại diện.')
    } catch (error) {
      setUploadError(userFacingError(error, 'Không thể cập nhật ảnh đại diện.'))
    }
  }

  const handleCopy = async () => {
    setCopyError(null)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(displayUserId)
      setCopied(true)
    } catch {
      setCopyError('Không thể sao chép mã người dùng.')
    }
  }

  return (
    <section className="rounded-xl border border-stone-700 bg-[#292a27] px-6 py-5 text-white shadow-sm" aria-label="Thông tin cá nhân">
      <div className="flex flex-col gap-6 min-[560px]:flex-row min-[560px]:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-5 max-[559px]:flex-col max-[559px]:text-center">
          <div className="shrink-0">
            <button
              type="button"
              tabIndex={0}
              aria-label="Đổi ảnh đại diện"
              aria-busy={avatarUploading}
              disabled={!canChangeAvatar || avatarUploading}
              onClick={openFilePicker}
              onKeyDown={handleAvatarKeyDown}
              className="group relative h-24 w-24 min-h-11 min-w-11 overflow-hidden rounded-full border-2 border-[#e9a12c] bg-stone-700 text-stone-100 outline-none transition focus-visible:ring-2 focus-visible:ring-[#e9a12c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#292a27] disabled:cursor-not-allowed"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={`Ảnh đại diện của ${user.name}`} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-stone-600 text-2xl font-medium text-stone-100">
                  {getInitials(user.name)}
                </span>
              )}
              {!avatarUploading && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/65 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <CameraIcon />
                  <span>Đổi ảnh</span>
                </span>
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/65" aria-hidden="true">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                </span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
              tabIndex={-1}
            />
          </div>

          <div className="min-w-0 flex-1 max-[559px]:flex max-[559px]:flex-col max-[559px]:items-center">
            <div className="flex flex-wrap items-center gap-2 max-[559px]:justify-center">
              <h1 className="text-xl font-medium leading-7 text-stone-100">{user.name}</h1>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${roleColor}`}>
                {roleLabel}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-stone-200 max-[559px]:justify-center">
              <MailIcon />
              <span className="truncate">{user.email}</span>
            </p>
            <button
              type="button"
              disabled={!canChangeAvatar || avatarUploading}
              onClick={openFilePicker}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-400 bg-transparent px-4 py-2 text-sm font-medium text-stone-100 transition hover:border-stone-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9a12c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {avatarUploading ? 'Đang tải lên…' : 'Đổi ảnh đại diện'}
            </button>
            {uploadError && <p className="mt-2 text-sm text-red-300" role="status" aria-live="polite">{uploadError}</p>}
            {successMessage && <p className="mt-2 text-sm text-emerald-300" role="status" aria-live="polite">{successMessage}</p>}
            <p className="mt-2 text-xs text-stone-300">JPG, PNG hoặc WEBP · tối đa 5 MB</p>
          </div>
        </div>

        <div className="flex min-w-0 w-full flex-col justify-center border-t-[0.5px] border-stone-600 pt-5 max-[559px]:text-center min-[560px]:w-72 min-[560px]:min-w-72 min-[560px]:shrink-0 min-[560px]:border-l-[0.5px] min-[560px]:border-t-0 min-[560px]:pl-6 min-[560px]:pt-0 min-[560px]:text-left">
          <p className="text-xs font-medium tracking-wide text-stone-300">Mã người dùng</p>
          <div className="mt-2 flex min-w-0 max-w-full items-center gap-2 max-[559px]:justify-center">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-stone-600 bg-stone-800 px-3 py-2 font-mono text-sm text-stone-100">{displayUserId}</code>
            <button
              type="button"
              aria-label="Sao chép mã người dùng"
              onClick={handleCopy}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-400 bg-transparent px-3 py-2 text-sm font-medium text-stone-100 transition hover:border-stone-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9a12c]"
            >
              <CopyIcon checked={copied} />
              <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
            </button>
          </div>
          {copyError && <p className="mt-2 text-sm text-red-300" role="status" aria-live="polite">{copyError}</p>}
          <div className="mt-5 flex items-center gap-2 text-sm text-stone-200 max-[559px]:justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>Tài khoản đang hoạt động</span>
          </div>
        </div>
      </div>
    </section>
  )
}
