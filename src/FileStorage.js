const DB_NAME = 'textv_files'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE_NAME, mode)
    const store = t.objectStore(STORE_NAME)
    return { store, complete: () => new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej }) }
  })
}

export async function saveFile(file) {
  const buffer = await file.arrayBuffer()
  const id = `${file.name}_${file.size}`
  const entry = {
    id,
    name: file.name,
    size: file.size,
    type: file.name.split('.').pop().toLowerCase(),
    data: buffer,
    savedAt: Date.now()
  }
  const { store, complete } = await tx('readwrite')
  store.put(entry)
  await complete()
  return id
}

export async function getFile(id) {
  const { store } = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFile(id) {
  const { store, complete } = await tx('readwrite')
  store.delete(id)
  await complete()
}

export async function listFiles() {
  const { store } = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const files = req.result || []
      files.sort((a, b) => b.savedAt - a.savedAt)
      resolve(files)
    }
    req.onerror = () => reject(req.error)
  })
}

export function entryToFile(entry) {
  return new File([entry.data], entry.name)
}
