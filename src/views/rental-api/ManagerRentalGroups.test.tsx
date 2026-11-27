import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { RentalApiRecord } from '../../types/rentalApi'
import ManagerRentalGroups from './ManagerRentalGroups'

const state = vi.hoisted(() => ({ pages: {} as Record<string, number> }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => initial === null ? [null, vi.fn()] : [state.pages, (next: (current: Record<string, number>) => Record<string, number>) => { state.pages = next(state.pages) }],
}))
vi.mock('../manager/managerPresentation', () => ({ useManagerPresentation: () => ({ copy: (value: string) => value }) }))

const rows = ['active', 'return_requested', 'completed'].flatMap(status => Array.from({ length: 7 }, (_, i) => ({
  id: `${status}-${i}`, status, displayCode: `${status}-${i}`, unitType: { name: 'Kho M' },
} as RentalApiRecord)))
function groups() {
  const tree = ManagerRentalGroups({ kind: 'rental', rows, onDetail: vi.fn() }) as ReactElement<{ children: unknown[] }>
  return tree.props.children[0] as ReactElement<{ id: string; children: ReactElement<{ rental: RentalApiRecord }>[]; footer: ReactElement<{ children: ReactElement[] }> }>[]
}
beforeEach(() => { state.pages = {} })
it('changes only the selected group and retains the other group pages', () => {
  const first = groups()
  expect(first.map(group => group.props.children.length)).toEqual([5, 5, 5])
  const next = (first[0].props.footer.props.children[1].props as { children: ReactElement<{ onClick: () => void }>[] }).children[1]
  next.props.onClick()
  const second = groups()
  expect(second[0].props.children.map(row => row.props.rental.id)).toEqual(['active-5', 'active-6'])
  expect(second[1].props.children[0].props.rental.id).toBe('return_requested-0')
  expect(second[2].props.children[0].props.rental.id).toBe('completed-0')
  const nextReturn = (second[1].props.footer.props.children[1].props as { children: ReactElement<{ onClick: () => void }>[] }).children[1]
  nextReturn.props.onClick()
  expect(groups().map(group => group.props.children[0].props.rental.id)).toEqual(['active-5', 'return_requested-5', 'completed-0'])
})
