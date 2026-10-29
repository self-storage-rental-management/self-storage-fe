import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime'
import { displayProps } from './displayText'

export { Fragment } from 'react/jsx-runtime'
export type { JSX } from 'react/jsx-runtime'
export const jsx: typeof reactJsx = (type, props, key) => reactJsx(type, displayProps(type, props), key)
export const jsxs: typeof reactJsxs = (type, props, key) => reactJsxs(type, displayProps(type, props), key)
