import { useEffect, useRef } from 'react'

export default function ManagerFormProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => { heading.current?.focus() }, [current])

  return <div className="space-y-2 rounded-lg bg-stone-50 px-4 py-3">
    <p className="text-xs font-medium text-stone-600">Bước {current + 1}/{steps.length}</p>
    <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold text-stone-900">{steps[current]}</h3>
    <div aria-hidden="true" className="flex gap-1.5">
      {steps.map((label, index) => <span key={label}
        className={`h-1.5 flex-1 rounded-full ${index <= current ? 'bg-amber-600' : 'bg-stone-200'}`} />)}
    </div>
  </div>
}
