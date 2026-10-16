// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NotesPanel } from '../src/renderer/src/components/workspace/NotesPanel'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import type { Note } from '../src/shared/types'

const note: Note = {
  id: 1, guid: 'n', scope: 'project', documentId: null, title: null, body: '',
  startPos: null, endPos: null, anchorStatus: 'attached', anchorText: null,
  createdAt: '2026-10-16', updatedAt: '2026-10-16'
}
beforeEach(() => {
  Object.defineProperty(window, 'api', { configurable: true, value: { app: { setNotesDirty: vi.fn() } } })
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ projectNotes: [note], editorNoteId: note.id, notesPanelOpen: true })
})
afterEach(cleanup)

it('flushes the newest draft even when a previous save is still in flight', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const writes: string[] = []
  useAppStore.setState({ updateNote: async (input) => {
    writes.push(input.body!)
    if (writes.length === 1) await gate
    return { ...note, title: input.title ?? null, body: input.body! }
  } })
  const user = userEvent.setup()
  render(<NotesPanel />)
  const input = screen.getByRole('textbox', { name: 'Conteúdo da nota' })
  await user.type(input, 'primeira')
  let flushing!: Promise<void>
  act(() => { flushing = useAppStore.getState().notesFlush!() })
  await user.type(input, ' e última')
  await act(async () => { release(); await flushing })
  expect(writes).toEqual(['primeira', 'primeira e última'])
  expect(useAppStore.getState().notasSujo).toBe(false)
  expect(screen.getByRole('status').textContent).toBe('Salvo')
})

it('keeps a note open with its draft when leaving cannot save it', async () => {
  useAppStore.setState({ updateNote: async () => { throw new Error('disco cheio') } })
  render(<NotesPanel />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Conteúdo da nota' }), 'não perder')
  await act(async () => {
    await expect(useAppStore.getState().toggleNotesPanel()).rejects.toThrow('disco cheio')
  })
  expect(useAppStore.getState().notesPanelOpen).toBe(true)
  expect(useAppStore.getState().notasSujo).toBe(true)
  expect((screen.getByRole('textbox', { name: 'Conteúdo da nota' }) as HTMLTextAreaElement).value).toBe('não perder')
  expect(screen.getByText('disco cheio')).toBeTruthy()
})
