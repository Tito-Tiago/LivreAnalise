// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Workspace } from '../src/renderer/src/components/workspace/Workspace'
import { useAppStore } from '../src/renderer/src/stores/appStore'

vi.mock('../src/renderer/src/components/workspace/TopBar', () => ({ TopBar: () => null }))
vi.mock('../src/renderer/src/components/workspace/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../src/renderer/src/components/workspace/TranscriptPanel', () => ({ TranscriptPanel: () => null }))
vi.mock('../src/renderer/src/components/workspace/NotesPanel', () => ({ NotesPanel: () => null }))
vi.mock('../src/renderer/src/components/workspace/CodeQuotationsDialog', () => ({ CodeQuotationsDialog: () => null }))
vi.mock('../src/renderer/src/components/workspace/UnsavedTextDialog', () => ({ UnsavedTextDialog: () => null }))

let requestClose: () => Promise<void>
const confirmClose = vi.fn()
const cancelClose = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState(useAppStore.getInitialState(), true)
  Object.defineProperty(window, 'api', { configurable: true, value: { app: {
    onCloseRequested: (listener: typeof requestClose) => { requestClose = listener; return () => {} },
    confirmClose, cancelClose
  } } })
})
afterEach(cleanup)

it.each(['sairDoCodigo', 'sairDaRenomeacao'] as const)('aguarda %s antes de confirmar o fechamento do aplicativo', async (hook) => {
  let finish!: (ok: boolean) => void
  useAppStore.setState({ [hook]: () => new Promise<boolean>((resolve) => { finish = resolve }) })
  render(<Workspace />)
  const pending = requestClose()
  expect(confirmClose).not.toHaveBeenCalled()
  await act(async () => { finish(true); await pending })
  expect(confirmClose).toHaveBeenCalledTimes(1)
  expect(cancelClose).not.toHaveBeenCalled()
})

it.each(['sairDoCodigo', 'sairDaRenomeacao'] as const)('cancela o fechamento do aplicativo quando %s falha', async (hook) => {
  useAppStore.setState({ [hook]: async () => false })
  render(<Workspace />)
  await act(async () => { await requestClose() })
  expect(confirmClose).not.toHaveBeenCalled()
  expect(cancelClose).toHaveBeenCalledTimes(1)
})
