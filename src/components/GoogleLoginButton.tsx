import { useEffect, useRef, useState } from 'react'

type GoogleCredentialResponse = {
  credential: string
}

type GoogleButtonOptions = {
  theme: 'outline' | 'filled_blue' | 'filled_black'
  size: 'small' | 'medium' | 'large'
  text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape: 'rectangular' | 'pill' | 'circle' | 'square'
  width: number
  locale: string
}

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId
      }
    }
  }
}

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let googleScriptPromise: Promise<void> | null = null

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    const script = existing || document.createElement('script')
    const finish = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services chưa sẵn sàng.'))
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Không thể tải Google Identity Services.')), { once: true })
    if (!existing) {
      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })
  return googleScriptPromise
}

export default function GoogleLoginButton({
  onCredential,
  text = 'signin_with',
  disabled = false,
}: {
  onCredential: (credential: string) => void | Promise<void>
  text?: GoogleButtonOptions['text']
  disabled?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) {
      setError('Chưa cấu hình Google Client ID.')
      return () => undefined
    }

    setError('')
    void loadGoogleIdentityServices()
      .then(() => {
        const container = containerRef.current
        const googleId = window.google?.accounts?.id
        if (cancelled || !container || !googleId) return
        container.replaceChildren()
        googleId.initialize({
          client_id: clientId,
          callback: response => {
            if (!cancelled && response.credential) void onCredential(response.credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        googleId.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: Math.min(container.clientWidth || 400, 400),
          locale: 'vi',
        })
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể khởi tạo đăng nhập Google.')
      })

    return () => {
      cancelled = true
      containerRef.current?.replaceChildren()
    }
  }, [onCredential, text])

  return (
    <div className={`space-y-1 ${disabled ? 'pointer-events-none opacity-60' : ''}`} aria-busy={disabled}>
      <div ref={containerRef} className="flex min-h-10 justify-center" />
      {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
    </div>
  )
}
