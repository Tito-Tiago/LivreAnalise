import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { writeAtomicFile, writeUniqueTextFile } from '../src/main/services/atomicFile'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'liva-atomic-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

it('never replaces an existing transcript and publishes complete contents', () => {
  const path = join(dir, 'audio_transcricao.txt')
  writeFileSync(path, 'revisado')
  const next = writeUniqueTextFile(path, 'novo')
  const third = writeUniqueTextFile(path, 'outro')
  expect(readFileSync(path, 'utf8')).toBe('revisado')
  expect(readFileSync(next, 'utf8')).toBe('novo')
  expect(readFileSync(third, 'utf8')).toBe('outro')
  expect(new Set([path, next, third]).size).toBe(3)
  expect(readdirSync(dir)).toHaveLength(3)
})

it('replaces metadata without leaving temporary files', () => {
  const path = join(dir, 'manifest.json')
  writeAtomicFile(path, 'old')
  writeAtomicFile(path, 'new')
  expect(readFileSync(path, 'utf8')).toBe('new')
  expect(readdirSync(dir)).toEqual(['manifest.json'])
})
