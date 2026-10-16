// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TranscribeView } from '../src/renderer/src/components/transcribe/TranscribeView'

const env = vi.fn()
const start = vi.fn()
const download = vi.fn()
let ready = true
beforeEach(() => {
  vi.clearAllMocks()
  ready = true
  env.mockImplementation(async (path) => ({
    ffmpeg: true, binaryPath: path === '/manual/whisper-cli' ? path : null,
    canDownloadBinary: false, defaultModelId: 'medium-q5_0'
  }))
  Object.defineProperty(window, 'api', { configurable: true, value: {
    transcription: {
      env, models: async () => [
        { id: 'medium-q5_0', label: 'Medium', approxBytes: 100, ready },
        { id: 'tiny', label: 'Tiny', approxBytes: 10, ready }
      ],
      onEvent: () => () => {}, pickMedia: async () => '/audio.wav',
      start, modelSize: async () => 100, downloadModel: download
    }
  } })
})
afterEach(cleanup)

async function configure(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  render(<TranscribeView onBack={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Escolher arquivo' }))
  await user.click(screen.getByRole('button', { name: 'Avançado' }))
  await user.type(screen.getByRole('textbox', { name: 'Caminho do whisper-cli' }), '/manual/whisper-cli')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Transcrever' }) as HTMLButtonElement).disabled).toBe(false))
  return user
}

it('enables transcription using a validated manual path when autodetection fails', async () => {
  const user = await configure()
  await user.click(screen.getByRole('button', { name: 'Transcrever' }))
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ binaryPath: '/manual/whisper-cli' }))
})

it('freezes the authorized model and becomes busy before the first download event', async () => {
  ready = false
  download.mockReturnValue(new Promise(() => {}))
  const user = await configure()
  await user.click(screen.getByRole('button', { name: 'Transcrever' }))
  const button = await screen.findByRole('button', { name: 'Baixar' })
  expect((screen.getByRole('combobox', { name: 'Modelo' }) as HTMLSelectElement).disabled).toBe(true)
  await user.click(button)
  expect(screen.queryByRole('button', { name: 'Baixar' })).toBeNull()
  expect(download).toHaveBeenCalledTimes(1)
  expect(download).toHaveBeenCalledWith('medium-q5_0')
})
