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
  prompt?: () => void
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

export function GoogleGLogo({ className = "w-5 h-5 shrink-0" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      style={{ display: 'inline-block', width: '20px', height: '20px', minWidth: '20px', minHeight: '20px' }}
      className={`show-icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
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
          width: 360,
          locale: 'vi',
        })
      })
      .catch(reason => {
        if (!cancelled) {
          console.error('[Google GIS Error]:', reason)
        }
      })

    return () => {
      cancelled = true
      containerRef.current?.replaceChildren()
    }
  }, [onCredential, text])

  const labelText = text === 'signup_with' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'

  return (
    <div className={`w-full relative ${disabled ? 'pointer-events-none opacity-60' : ''}`} aria-busy={disabled}>
      {/* Visual Google Button with Official 4-color G Logo on the left */}
      <div className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-all shadow-2xs cursor-pointer select-none">
        <GoogleGLogo className="w-5 h-5 shrink-0" />
        <span>{labelText}</span>
      </div>

      {/* Google GIS container on top for native One-Tap / OAuth iframe click */}
      <div
        ref={containerRef}
        style={{ opacity: 0.001 }}
        className="absolute inset-0 overflow-hidden cursor-pointer flex justify-center items-center"
      />

      {error && <p role="alert" className="text-center text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
