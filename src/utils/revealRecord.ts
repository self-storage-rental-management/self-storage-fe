const recordAnimations = new WeakMap<HTMLElement, Animation>()

export function revealRecord(record: HTMLElement) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  record.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'instant' : 'smooth' })
  record.focus({ preventScroll: true })

  recordAnimations.get(record)?.cancel()
  const frames: Keyframe[] = [
    { outline: '2px solid transparent', outlineOffset: '2px' },
    { outline: '2px solid #b45309', outlineOffset: '2px', offset: 0.22 },
    { outline: '2px solid #b45309', outlineOffset: '2px', offset: 0.7 },
    { outline: '2px solid transparent', outlineOffset: '2px' },
  ]
  if (!reduceMotion) {
    frames[0].translate = '0 0'
    frames[1].translate = '0 -4px'
    frames[2].translate = '0 0'
    frames[3].translate = '0 0'
  }
  recordAnimations.set(record, record.animate(frames, { duration: 1300, easing: 'ease-out' }))
}
