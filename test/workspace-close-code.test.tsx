// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppCloseDialog } from '../src/renderer/src/components/workspace/AppCloseDialog'
import { useAppStore } from '../src/renderer/src/stores/appStore'

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
  render(<AppCloseDialog />)
  const pending = requestClose()
  expect(confirmClose).not.toHaveBeenCalled()
  await act(async () => { finish(true); await pending })
  expect(confirmClose).toHaveBeenCalledTimes(1)
  expect(cancelClose).not.toHaveBeenCalled()
})

it.each(['sairDoCodigo', 'sairDaRenomeacao'] as const)('cancela o fechamento do aplicativo quando %s falha', async (hook) => {
  useAppStore.setState({ [hook]: async () => false })
  render(<AppCloseDialog />)
  await act(async () => { await requestClose() })
  expect(confirmClose).not.toHaveBeenCalled()
  expect(cancelClose).toHaveBeenCalledTimes(1)
})
