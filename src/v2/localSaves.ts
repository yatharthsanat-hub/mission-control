import { decodeSave, encodeSave } from './saveFormat.ts'
import type { Save } from './saveFormat.ts'

export interface StoredSave {
  raw: string | undefined
  backup: string | undefined
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
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Save read failed.')) }
    tx.oncomplete = () => { db.close(); resolve({ raw: active.result, backup: backup.result }) }
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
    let reason: Error | undefined
    active.onsuccess = () => {
      if (active.result !== expected) {
        reason = new Error('Another tab changed this save. Reload the saved agency before trying again.')
        tx.abort()
        return
      }
      if (expected !== undefined) {
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
        if (mode === 'replace') store.put(expected, `archive:${save.id}`)
      }
      store.put(next, 'active')
    }
    tx.onabort = () => { db.close(); reject(reason ?? tx.error ?? new Error('Local write failed.')) }
    tx.oncomplete = () => { db.close(); resolve(next) }
  })
}
