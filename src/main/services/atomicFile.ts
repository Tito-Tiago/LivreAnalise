import { randomUUID } from 'crypto'
import { linkSync, renameSync, rmSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'

function withTemporaryFile<T>(path: string, text: string, publish: (tmp: string) => T): T {
  const tmp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    writeFileSync(tmp, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return publish(tmp)
  } finally {
    rmSync(tmp, { force: true })
  }
}

export function writeAtomicFile(path: string, text: string): void {
  withTemporaryFile(path, text, (tmp) => renameSync(tmp, path))
}

// O hard link publica apenas o arquivo completo, sem sobrescrever nada, mesmo
// se outra operação escolher o mesmo nome entre a verificação e a escrita.
export function writeUniqueTextFile(path: string, text: string): string {
  return withTemporaryFile(path, text, (tmp) => {
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? path : path.replace(/(\.[^./\\]+)?$/, ` (${n})$1`)
      try {
        linkSync(tmp, candidate)
        return candidate
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
  })
}
