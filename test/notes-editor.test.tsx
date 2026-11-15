// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

it('Esc salva o rascunho antes de fechar o painel, inclusive com foco no editor', async () => {
  const updateNote = vi.fn(async (input) => ({ ...note, title: input.title, body: input.body }))
  useAppStore.setState({ updateNote })
  render(<NotesPanel />)
  const input = screen.getByRole('textbox', { name: 'Conteúdo da nota' })
  fireEvent.change(input, { target: { value: 'guardar antes de sair' } })
  await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }) })
  expect(updateNote).toHaveBeenCalledWith({ id: note.id, title: null, body: 'guardar antes de sair' })
  expect(useAppStore.getState().notesPanelOpen).toBe(false)
  expect(useAppStore.getState().notasSujo).toBe(false)
})

it('Esc mantém o painel e o rascunho se não conseguir salvar', async () => {
  useAppStore.setState({ updateNote: async () => { throw new Error('disco cheio') } })
  render(<NotesPanel />)
  const input = screen.getByRole('textbox', { name: 'Conteúdo da nota' })
  fireEvent.change(input, { target: { value: 'não perder' } })
  await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }) })
  expect(useAppStore.getState().notesPanelOpen).toBe(true)
  expect(useAppStore.getState().notasSujo).toBe(true)
  expect((input as HTMLTextAreaElement).value).toBe('não perder')
  expect(screen.getByRole('alert').textContent).toBe('disco cheio')
})

it('Esc fecha a lista mesmo quando o foco está fora do painel', async () => {
  useAppStore.setState({ editorNoteId: null })
  render(<NotesPanel />)
  await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }) })
  expect(useAppStore.getState().notesPanelOpen).toBe(false)
})

it('Esc não fecha as notas quando há um diálogo sobreposto', async () => {
  render(<><NotesPanel /><div role="dialog">Confirmação</div></>)
  await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }) })
  expect(useAppStore.getState().notesPanelOpen).toBe(true)
})

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

it('clears pending-note state when its document is deleted', async () => {
  Object.assign(window.api, {
    documents: { delete: vi.fn(async () => {}), list: async () => [] },
    notes: { listProject: async () => [] },
    codes: { list: async () => [] },
    history: { state: async () => ({}) },
    project: { close: async () => {}, recents: async () => [] }
  })
  useAppStore.setState({
    projectNotes: [], documentNotes: [{ ...note, scope: 'document', documentId: 1 }],
    currentDocument: { id: 1, plainText: 'texto' } as any
  })
  render(<NotesPanel />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Conteúdo da nota' }), 'rascunho')
  expect(useAppStore.getState().notasSujo).toBe(true)
  await act(async () => { await useAppStore.getState().deleteDocument(1) })
  expect(useAppStore.getState().notesFlush).toBeNull()
  expect(useAppStore.getState().notasSujo).toBe(false)
  expect(window.api.app.setNotesDirty).toHaveBeenLastCalledWith(false)
  await act(async () => { await useAppStore.getState().closeProject() })
  expect(useAppStore.getState().notasSujo).toBe(false)
})
