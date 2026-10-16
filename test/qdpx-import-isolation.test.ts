import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase, getActivePath, closeDatabase } from '../src/main/db'
import { listCodes, createCode } from '../src/main/db/repositories'
import { importProjectIntoDb } from '../src/main/qdpx/import'
import { serializeQdpx } from '../src/main/qdpx/serialize'
import { importQdpxAsProject } from '../src/main/ipc/qdpx'
import type { QdpxProject } from '../src/main/qdpx/model'

const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('electron', () => ({
  app: { getVersion: () => '0.7.0' },
  dialog: { showSaveDialog: save }, ipcMain: { handle: vi.fn() }
}))
vi.mock('../src/main/services/recents', () => ({ pushRecent: vi.fn() }))

let dir: string
const project: QdpxProject = {
  name: 'P', users: [], codes: [{ guid: 'c', name: 'Importado', parentGuid: null }],
  documents: [], notes: [], groups: [], projectNoteGuids: []
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'liva-import-'))
  openDatabase(join(dir, 'original.liva'))
  createCode({ name: 'Original', color: '#112233' })
})
afterEach(() => { closeDatabase(); rmSync(dir, { recursive: true, force: true }) })

it('rolls back all inserted records on a duplicate GUID', () => {
  expect(() => importProjectIntoDb({
    project: { ...project, codes: [...project.codes, ...project.codes] }, skipped: []
  })).toThrow()
  expect(listCodes().map((c) => c.name)).toEqual(['Original'])
})

it('keeps the original connection and data when the archive is invalid', async () => {
  const original = getActivePath()
  const archive = join(dir, 'invalid.qdpx')
  writeFileSync(archive, 'not a zip')
  save.mockResolvedValue({ filePath: join(dir, 'new.liva') })
  await expect(importQdpxAsProject(archive)).rejects.toThrow()
  expect(getActivePath()).toBe(original)
  expect(listCodes().map((c) => c.name)).toEqual(['Original'])
})

it('refuses to overwrite an existing destination', async () => {
  const dest = join(dir, 'existing.liva')
  writeFileSync(dest, 'preserve')
  save.mockResolvedValue({ filePath: dest })
  await expect(importQdpxAsProject('unused')).rejects.toThrow('arquivo novo')
  expect(readFileSync(dest, 'utf8')).toBe('preserve')
})

it('publishes the isolated import only after success', async () => {
  const archive = join(dir, 'valid.qdpx')
  writeFileSync(archive, await serializeQdpx(project))
  const dest = join(dir, 'imported.liva')
  save.mockResolvedValue({ filePath: dest })
  const result = await importQdpxAsProject(archive)
  expect(result?.path).toBe(dest)
  expect(listCodes().map((c) => c.name)).toEqual(['Importado'])
})
