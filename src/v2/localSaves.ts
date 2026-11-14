import { decodeSave, encodeSave, sameSaveContents } from './saveFormat.ts'
import type { Save } from './saveFormat.ts'

export interface StoredSave {
  raw: string | undefined
  backup: string | undefined
  archives: readonly { key: string; raw: string }[]
}

function archiveRange() {
  return IDBKeyRange.bound('archive:', 'archive;', false, true)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mission-control-v2', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('saves')
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Close other Mission Control tabs and retry opening local saves.'))
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

export async function readLocal(): Promise<StoredSave> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly')
    const store = tx.objectStore('saves')
    const active = store.get('active')
    const backup = store.get('backup')
    const keys = store.getAllKeys(archiveRange())
    const values = store.getAll(archiveRange())
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Save read failed.')) }
    tx.oncomplete = () => {
      db.close()
      const archives = keys.result.flatMap((key, index) => {
        const raw: unknown = values.result[index]
        return typeof key === 'string' && typeof raw === 'string' ? [{ key, raw }] : []
      })
      resolve({ raw: active.result, backup: backup.result, archives })
    }
  })
}

export async function writeLocal(expected: string | undefined, save: Save, mode: 'update' | 'replace' = 'update') {
  const next = encodeSave(save)
  decodeSave(next)
  const db = await openDatabase()
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite')
    const store = tx.objectStore('saves')
    const active = store.get('active')
    let result = next
    let reason: Error | undefined
    active.onsuccess = () => {
      if (active.result !== expected) {
        reason = new Error('Another tab changed this save. Reload the saved agency before trying again.')
        tx.abort()
        return
      }
      if (expected !== undefined) {
        if (mode === 'replace' && sameSaveContents(expected, next)) {
          result = expected
          return
        }
        let readable = false
        try {
          decodeSave(expected)
          readable = true
        } catch {
          // Preserve the last readable backup during an explicit recovery.
        }
        if (!readable && mode !== 'replace') {
          reason = new Error('Use the recovery controls to replace an unreadable save.')
          tx.abort()
          return
        }
        if (readable) store.put(expected, 'backup')
        if (mode === 'replace') {
          const archives = store.getAll(archiveRange())
          archives.onsuccess = () => {
            if (!archives.result.some((raw: unknown) => typeof raw === 'string' && sameSaveContents(expected, raw))) {
              store.add(expected, `archive:${save.id}`)
            }
            store.put(next, 'active')
          }
          return
        }
      }
      store.put(next, 'active')
    }
    tx.onabort = () => { db.close(); reject(reason ?? tx.error ?? new Error('Local write failed.')) }
    tx.oncomplete = () => { db.close(); resolve(result) }
  })
}
