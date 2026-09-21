import { useLanguage } from '../i18n/LanguageContext'

interface LanguageToggleProps {
  className?: string
  variant?: 'pill' | 'button' | 'dropdown'
}

export default function LanguageToggle({ className = '', variant = 'pill' }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage()

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-[#3a3933] border border-stone-200 dark:border-[#4b4940] text-xs font-mono select-none ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLang('vi')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
          lang === 'vi'
            ? 'bg-[#e9a12c] text-[#292a27] font-bold shadow-sm'
            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 hover:bg-white/60 dark:hover:bg-white/10'
        }`}
        title="Chuyển sang Tiếng Việt"
      >
        <span>VI</span>
      </button>

      <button
        type="button"
        onClick={() => setLang('en')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
          lang === 'en'
            ? 'bg-[#e9a12c] text-[#292a27] font-bold shadow-sm'
            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 hover:bg-white/60 dark:hover:bg-white/10'
        }`}
        title="Switch to English"
      >
        <span>EN</span>
      </button>
    </div>
  )
}
