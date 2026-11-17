import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import { casaBusca, mesmoTermo } from '@shared/busca'
import { Link2, Plus, StickyNote } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { applicableCodes } from '@shared/codeTree'

interface Props {
  x: number
  y: number
  onClose: (reason: 'escape' | 'outside') => void
  onApply: (codeId: number) => void
  // Criar código abre o diálogo de configuração (cor, descrição) com o nome já
  // digitado; quem chama aplica ao trecho depois de salvo.
  onCreate: (name: string) => void
  // Texto do trecho selecionado no documento, para o Ctrl+C (#72).
  selectedText: string
  onAddNote?: () => void
  onReattachNote?: () => void
}

export function CodingPopover({
  x,
  y,
  onClose,
  onApply,
  onCreate,
  selectedText,
  onAddNote,
  onReattachNote
}: Props): JSX.Element {
  const allCodes = useAppStore((s) => s.codes)
  const lastUsedCodeId = useAppStore((s) => s.lastUsedCodeId)
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    inputRef.current?.focus()
    const onDocMouseDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose('outside')
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [onClose])

  // Grupo nao recebe citacao: so o codigo-folha e aplicavel a um trecho.
  const codes = useMemo(() => applicableCodes(allCodes), [allCodes])

  const filtered = codes.filter((c) =>
    casaBusca(c.name, filter)
  )
  const lastUsed = codes.find((c) => c.id === lastUsedCodeId)
  const showLastUsed = lastUsed != null && filter === ''
  const listCodes = showLastUsed
    ? filtered.filter((c) => c.id !== lastUsedCodeId)
    : filtered
  const exactMatch = allCodes.some(
    (c) => mesmoTermo(c.name, filter)
  )
  const options: Array<{ key: string; label: string; action: () => void; color?: string; last?: boolean }> = [
    ...(showLastUsed && lastUsed ? [{ key: `code-${lastUsed.id}`, label: lastUsed.name, color: lastUsed.color, last: true, action: () => onApply(lastUsed.id) }] : []),
    ...listCodes.map((c) => ({ key: `code-${c.id}`, label: c.name, color: c.color, action: () => onApply(c.id) })),
    ...(filter.trim() && !exactMatch ? [{ key: 'create', label: `Criar código "${filter.trim()}"`, action: () => onCreate(filter.trim()) }] : []),
    ...(onAddNote ? [{ key: 'note', label: 'Adicionar nota ao trecho', action: onAddNote }] : []),
    ...(onReattachNote ? [{ key: 'reattach', label: 'Religar a nota aberta a este trecho', action: onReattachNote }] : [])
  ]
  const activeIndex = Math.min(active, Math.max(0, options.length - 1))

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, filter])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // O popover abre com o foco no campo de busca, então o Ctrl+C ia para o
    // campo vazio e o trecho selecionado no texto não era copiado (#72). Com
    // nada selecionado no campo, o Ctrl+C copia o trecho.
    const campo = e.currentTarget as HTMLInputElement
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'c' &&
      campo.selectionStart === campo.selectionEnd
    ) {
      e.preventDefault()
      void navigator.clipboard.writeText(selectedText)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose('escape')
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length) setActive((activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      options[activeIndex]?.action()
    }
  }

  const maxX = window.innerWidth - 300
  const left = Math.min(x, maxX)
  const top = Math.min(y, window.innerHeight - 360)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Codificar trecho"
      className="fixed z-50 w-72 rounded-md border bg-popover p-2 shadow-lg"
      style={{ left, top }}
      onCopy={(e) => {
        const input = inputRef.current
        if (document.activeElement === input && input?.selectionStart !== input?.selectionEnd) return
        e.preventDefault()
        e.clipboardData.setData('text/plain', selectedText)
      }}
      onKeyDown={(e) => {
        if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'c') return
        const input = inputRef.current
        if (document.activeElement === input && input?.selectionStart !== input?.selectionEnd) return
        e.preventDefault()
        void navigator.clipboard.writeText(selectedText).catch(() => {
          alert('Não foi possível copiar o trecho. Tente novamente.')
        })
      }}
    >
      <input
        ref={inputRef}
        value={filter}
        onChange={(e) => { setFilter(e.target.value); setActive(0) }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar ou criar código..."
        aria-label="Buscar ou criar código"
        role="combobox"
        aria-expanded="true"
        aria-controls="coding-options"
        aria-activedescendant={options.length ? `coding-option-${activeIndex}` : undefined}
        className="mb-2 h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div id="coding-options" role="listbox" aria-label="Ações para o trecho" className="max-h-56 overflow-auto">
        {options.map((option, index) => (
          <button
            key={option.key}
            ref={(el) => { optionRefs.current[index] = el }}
            id={`coding-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            type="button"
            title={option.label}
            onMouseMove={() => setActive(index)}
            onClick={option.action}
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent ${index === activeIndex ? 'bg-accent ring-1 ring-inset ring-primary' : ''}`}
          >
            {option.color ? <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> :
              option.key === 'note' ? <StickyNote className="h-4 w-4" /> :
                option.key === 'reattach' ? <Link2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="truncate">{option.label}</span>
            {option.last && <span className="ml-auto text-xs text-muted-foreground">último</span>}
          </button>
        ))}
        {listCodes.length === 0 && !filter.trim() && !showLastUsed && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Digite para buscar ou criar um código
          </p>
        )}
      </div>
    </div>
  )
}
