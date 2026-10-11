interface BrandLogoProps {
  light?: boolean
  subtitle?: string
  className?: string
  imgClassName?: string
}

export default function BrandLogo({ light = false, subtitle, className = '', imgClassName = 'h-9 w-auto max-w-full object-contain' }: BrandLogoProps) {
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`} aria-label="StorageHub">
      <img
        src={light ? '/storagehub-logo-light.png' : '/storagehub-logo.png'}
        alt="StorageHub"
        className={imgClassName}
      />
      {subtitle && <span className={`font-mono text-[10px] uppercase tracking-[.08em] ${light ? 'text-stone-400' : 'text-stone-500'}`}>{subtitle}</span>}
    </div>
  )
}
