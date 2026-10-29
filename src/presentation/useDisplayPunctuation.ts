import { useLayoutEffect } from 'react'
import { displayText } from './displayText'

const attributes = ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription']

/** Covers text produced outside our JSX runtime, including chart libraries and portals. */
export function observeDisplayPunctuation(root: HTMLElement) {
  const clean = (node: Node) => {
    if (node.nodeType === 3) {
      if (node.parentElement?.closest('script,style,noscript,textarea,[contenteditable="true"]')) return
      if (node.nodeValue?.includes('\u003b')) node.nodeValue = displayText(node.nodeValue)
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    for (const name of attributes) {
      const value = element.getAttribute(name)
      if (value?.includes('\u003b')) element.setAttribute(name, displayText(value))
    }
    for (const child of Array.from(node.childNodes)) clean(child)
  }
  clean(root)
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of Array.from(record.addedNodes)) clean(node)
      } else if (record.type === 'attributes') {
        const element = record.target as Element
        const name = record.attributeName!
        const value = element.getAttribute(name)
        if (value?.includes('\u003b')) element.setAttribute(name, displayText(value))
      } else clean(record.target)
    }
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes })
  return () => observer.disconnect()
}

export function useDisplayPunctuation(enabled: boolean) {
  useLayoutEffect(() => {
    if (enabled && typeof document !== 'undefined') return observeDisplayPunctuation(document.body)
  }, [enabled])
}
