import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'

type Position = { x: number; y: number }
type Drag = {
  pointerId: number
  start: Position
  origin: Position
  previousPosition: Position | undefined
  moved: boolean
}

const POSITION_KEY = 'storagehub:chat-launcher-position'
const EDGE_MARGIN = 8
const DRAG_THRESHOLD = 6
const KEYBOARD_STEP = 24

function loadPosition(): Position | undefined {
  try {
    const saved = localStorage.getItem(POSITION_KEY)
    const position = saved ? JSON.parse(saved) as Position | null : null
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) return position
  } catch {
    // If storage is unavailable, start at the default position.
  }
}

function constrainPosition(button: HTMLButtonElement, x: number, y: number): Position {
  const { clientWidth, clientHeight } = document.documentElement
  return {
    x: Math.max(EDGE_MARGIN, Math.min(x, clientWidth - button.offsetWidth - EDGE_MARGIN)),
    y: Math.max(EDGE_MARGIN, Math.min(y, clientHeight - button.offsetHeight - EDGE_MARGIN)),
  }
}

export function useMovableChatLauncher(openChat: () => void) {
  const [position, setPosition] = useState(loadPosition)
  const drag = useRef<Drag | null>(null)
  const ignorePointerClick = useRef(false)

  function savePosition(next: Position) {
    setPosition(next)
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(next))
    } catch {
      // The launcher still moves when storage is unavailable.
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    const { left, top } = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    ignorePointerClick.current = false
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: left, y: top },
      previousPosition: position,
      moved: false,
    }
  }

  function pointerPosition(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId) return
    const dx = event.clientX - active.start.x
    const dy = event.clientY - active.start.y
    if (!active.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    active.moved = true
    return constrainPosition(event.currentTarget, active.origin.x + dx, active.origin.y + dy)
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const next = pointerPosition(event)
    if (next) setPosition(next)
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    const next = pointerPosition(event)
    drag.current = null
    if (next) {
      ignorePointerClick.current = true
      savePosition(next)
    }
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId) return
    drag.current = null
    if (active.moved) {
      ignorePointerClick.current = true
      setPosition(active.previousPosition)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (drag.current) return
    let dx = 0
    let dy = 0
    switch (event.key) {
      case 'ArrowLeft': dx = -KEYBOARD_STEP; break
      case 'ArrowRight': dx = KEYBOARD_STEP; break
      case 'ArrowUp': dy = -KEYBOARD_STEP; break
      case 'ArrowDown': dy = KEYBOARD_STEP; break
      default: return
    }
    event.preventDefault()
    const { left, top } = event.currentTarget.getBoundingClientRect()
    savePosition(constrainPosition(event.currentTarget, left + dx, top + dy))
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 0 && ignorePointerClick.current) {
      ignorePointerClick.current = false
      return
    }
    openChat()
  }

  // Both launchers are 3rem square. CSS reapplies the bounds when the viewport resizes.
  const style: CSSProperties | undefined = position && {
    inset: `clamp(${EDGE_MARGIN}px, ${position.y}px, calc(100dvh - 3rem - ${EDGE_MARGIN}px)) auto auto clamp(${EDGE_MARGIN}px, ${position.x}px, calc(100% - 3rem - ${EDGE_MARGIN}px))`,
  }

  return {
    style, onClick, onKeyDown, onPointerDown, onPointerMove, onPointerUp,
    onPointerCancel: cancelDrag, onLostPointerCapture: cancelDrag,
    title: 'Bấm để mở chat. Giữ và kéo để di chuyển.',
    'aria-description': 'Giữ và kéo hoặc dùng các phím mũi tên để di chuyển nút chat.',
  }
}
