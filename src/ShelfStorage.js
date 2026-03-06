const STORAGE_KEY = 'textv_shelves'

function loadShelves() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function saveShelves(shelves) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves))
}

export function getShelves() {
  return loadShelves()
}

export function createShelf(name) {
  const shelves = loadShelves()
  const shelf = {
    id: `shelf_${Date.now()}`,
    name: name.trim(),
    fileIds: []
  }
  shelves.push(shelf)
  saveShelves(shelves)
  return shelf
}

export function renameShelf(shelfId, newName) {
  const shelves = loadShelves()
  const shelf = shelves.find(s => s.id === shelfId)
  if (shelf) {
    shelf.name = newName.trim()
    saveShelves(shelves)
  }
}

export function deleteShelf(shelfId) {
  const shelves = loadShelves().filter(s => s.id !== shelfId)
  saveShelves(shelves)
}

export function addFileToShelf(shelfId, fileId) {
  const shelves = loadShelves()
  shelves.forEach(s => {
    s.fileIds = s.fileIds.filter(id => id !== fileId)
  })
  const shelf = shelves.find(s => s.id === shelfId)
  if (shelf) {
    shelf.fileIds.push(fileId)
  }
  saveShelves(shelves)
}

export function removeFileFromShelf(fileId) {
  const shelves = loadShelves()
  shelves.forEach(s => {
    s.fileIds = s.fileIds.filter(id => id !== fileId)
  })
  saveShelves(shelves)
}

export function getShelfForFile(fileId) {
  const shelves = loadShelves()
  return shelves.find(s => s.fileIds.includes(fileId)) || null
}
