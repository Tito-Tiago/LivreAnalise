import { type JSX, useEffect, useRef, useState } from 'react'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { TranscriptPanel } from './TranscriptPanel'
import { NotesPanel } from './NotesPanel'
import { CodeQuotationsDialog } from './CodeQuotationsDialog'
import { UnsavedTextDialog } from './UnsavedTextDialog'
import { useAppStore } from '@/stores/appStore'
import type { CodeWithCount } from '@shared/types'
import { mensagemDeErro } from '@/lib/erros'
import { QuickDocumentDialog } from './QuickDocumentDialog'

export function Workspace(): JSX.Element {
  const [viewCode, setViewCode] = useState<CodeWithCount | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef(new Map<string, HTMLElement>())
  const notesPanelOpen = useAppStore((s) => s.notesPanelOpen)
  const podeSairDoTexto = useAppStore((s) => s.podeSairDoTexto)

  useEffect(() => {
    const rememberFocus = (event: FocusEvent): void => {
      const element = event.target
      if (!(element instanceof HTMLElement)) return
      const area = element.closest<HTMLElement>('[data-workspace-area]')?.dataset.workspaceArea
      if (area) lastFocus.current.set(area, element)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setQuickOpen(true)
        return
      }
      if (event.key !== 'F6' || event.ctrlKey || event.metaKey || event.altKey) return
      const root = workspaceRef.current
      if (!root) return
      const areas = Array.from(root.querySelectorAll<HTMLElement>('[data-workspace-area]'))
      if (!areas.length) return
      const current = areas.findIndex((area) => area.contains(document.activeElement))
      const direction = event.shiftKey ? -1 : 1
      const origin = current < 0 ? (direction === 1 ? -1 : 0) : current
      for (let step = 1; step <= areas.length; step++) {
        const next = areas[(origin + direction * step + areas.length * 2) % areas.length]
        const remembered = lastFocus.current.get(next.dataset.workspaceArea ?? '')
        const target = remembered?.isConnected && next.contains(remembered) && !remembered.matches(':disabled')
          ? remembered
          : next.querySelector<HTMLElement>('[data-area-default]:not([disabled])') ??
            next.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]')
        if (!target) continue
        event.preventDefault()
        target.focus()
        return
      }
    }
    document.addEventListener('focusin', rememberFocus)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('focusin', rememberFocus)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // O main pede isto quando há edição ou renomeação ainda não salva.
  useEffect(
    () =>
      window.api.app.onCloseRequested(async () => {
        try {
          const sairDaRenomeacao = useAppStore.getState().sairDaRenomeacao
          if (sairDaRenomeacao && !(await sairDaRenomeacao())) {
            window.api.app.cancelClose()
            return
          }
          const sairDoCodigo = useAppStore.getState().sairDoCodigo
          if (sairDoCodigo && !(await sairDoCodigo())) {
            window.api.app.cancelClose()
            return
          }
          const sairDoMemo = useAppStore.getState().sairDoMemo
          if (sairDoMemo && !(await sairDoMemo())) {
            window.api.app.cancelClose()
            return
          }
          if (!(await podeSairDoTexto())) {
            window.api.app.cancelClose()
            return
          }
          await useAppStore.getState().notesFlush?.()
          window.api.app.confirmClose()
        } catch (e) {
          window.api.app.cancelClose()
          alert(mensagemDeErro(e, 'Não foi possível salvar as notas. A janela permanecerá aberta.'))
        }
      }),
    [podeSairDoTexto]
  )

  return (
    <div ref={workspaceRef} className="flex h-full flex-col">
      <div data-workspace-area="toolbar"><TopBar /></div>
      <div className="flex min-h-0 flex-1">
        <div data-workspace-area="sidebar" className="contents"><Sidebar onViewCode={setViewCode} /></div>
        <div data-workspace-area="document" className="flex min-w-0 flex-1"><TranscriptPanel /></div>
        {notesPanelOpen && <div data-workspace-area="notes" className="contents"><NotesPanel /></div>}
      </div>
      <CodeQuotationsDialog
        code={viewCode}
        onOpenChange={(o) => !o && setViewCode(null)}
      />
      <UnsavedTextDialog />
      <QuickDocumentDialog open={quickOpen} onOpenChange={setQuickOpen} onOpened={() => {
        requestAnimationFrame(() => {
          const reader = workspaceRef.current?.querySelector<HTMLTextAreaElement>('textarea[aria-label^="Navegação somente leitura"]')
          if (reader) reader.focus()
          else workspaceRef.current?.querySelector<HTMLButtonElement>('[data-focus-document]')?.click()
        })
      }} />
    </div>
  )
}
