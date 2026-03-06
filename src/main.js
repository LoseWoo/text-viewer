import './style.css'
import { TextReader } from './TextReader.js'
import { EpubReader } from './EpubReader.js'
import { saveFile, getFile, deleteFile, listFiles, entryToFile } from './FileStorage.js'
import {
  getShelves, createShelf, renameShelf, deleteShelf,
  addFileToShelf, removeFileFromShelf, getShelfForFile
} from './ShelfStorage.js'

// ===== State =====
let currentView = 'home'
let textReader = null
let epubReader = null
let currentFile = null

const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

let fontSize = parseInt(localStorage.getItem('textv_fontsize') || '17')
let fontFamily = localStorage.getItem('textv_fontfamily') || 'system'
let lineHeight = parseFloat(localStorage.getItem('textv_lineheight') || '1.8')
let epubScrollMode = localStorage.getItem('textv_epubscroll') || 'scrolled-doc'

// ===== Toast =====
let toastTimer = null
function showToast(msg) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800)
}

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem('textv_theme')
  if (saved) {
    document.documentElement.dataset.theme = saved
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light'
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('textv_theme', next)

  if (epubReader && currentView === 'epub') {
    epubReader.updateTheme()
  }
}

// ===== Font Size =====
function setFontSize(size) {
  fontSize = Math.max(12, Math.min(32, size))
  document.documentElement.style.setProperty('--font-size', `${fontSize}px`)
  localStorage.setItem('textv_fontsize', fontSize.toString())

  document.querySelectorAll('.size-slider[id$="font-range"]').forEach(el => { el.value = fontSize })
  document.querySelectorAll('[id$="font-value"]').forEach(el => { el.textContent = `${fontSize}px` })

  if (epubReader && currentView === 'epub') {
    epubReader.applyFontSize(fontSize)
  }
}

// ===== Font Family =====
function resolveFont(key) {
  return key === 'system' ? SYSTEM_FONT : key
}

function setFontFamily(key) {
  fontFamily = key
  const resolved = resolveFont(key)
  document.documentElement.style.setProperty('--font-family', resolved)
  localStorage.setItem('textv_fontfamily', key)

  document.querySelectorAll('.font-list').forEach(list => {
    list.querySelectorAll('.font-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === key)
    })
  })

  if (epubReader && currentView === 'epub') {
    epubReader.applyFontFamily(resolved)
  }
}

// ===== Line Height =====
function setLineHeight(value) {
  lineHeight = Math.max(1.2, Math.min(2.4, parseFloat(value)))
  document.documentElement.style.setProperty('--line-height', lineHeight.toString())
  localStorage.setItem('textv_lineheight', lineHeight.toString())

  document.querySelectorAll('.size-slider[id$="lh-range"]').forEach(el => { el.value = lineHeight })
  document.querySelectorAll('[id$="lh-value"]').forEach(el => { el.textContent = lineHeight.toFixed(1) })

  if (epubReader && currentView === 'epub') {
    epubReader.applyLineHeight(lineHeight)
  }
}

// ===== EPUB Scroll Mode =====
function setEpubScrollMode(mode) {
  epubScrollMode = mode
  localStorage.setItem('textv_epubscroll', mode)

  document.getElementById('epub-mode-page').classList.toggle('active', mode === 'paginated')
  document.getElementById('epub-mode-scroll').classList.toggle('active', mode === 'scrolled-doc')
  document.getElementById('epub-nav').classList.remove('hidden')

  if (epubReader && currentView === 'epub') {
    epubReader.setFlowMode(mode)
  }
}

// ===== View Switching =====
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.getElementById(`${name}-view`).classList.add('active')
  currentView = name
}

function goHome() {
  if (textReader) { textReader.destroy(); textReader = null }
  if (epubReader) { epubReader.destroy(); epubReader = null }
  currentFile = null
  showView('home')
  renderLibrary()
}

// ===== Settings Panel =====
function openSettings(id) {
  document.getElementById(id).classList.remove('hidden')
}

function closeSettings(id) {
  document.getElementById(id).classList.add('hidden')
}

function syncSettingsUI() {
  document.querySelectorAll('.size-slider[id$="font-range"]').forEach(el => { el.value = fontSize })
  document.querySelectorAll('[id$="font-value"]').forEach(el => { el.textContent = `${fontSize}px` })
  document.querySelectorAll('.size-slider[id$="lh-range"]').forEach(el => { el.value = lineHeight })
  document.querySelectorAll('[id$="lh-value"]').forEach(el => { el.textContent = lineHeight.toFixed(1) })
  document.querySelectorAll('.font-list').forEach(list => {
    list.querySelectorAll('.font-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === fontFamily)
    })
  })
  document.getElementById('epub-mode-page').classList.toggle('active', epubScrollMode === 'paginated')
  document.getElementById('epub-mode-scroll').classList.toggle('active', epubScrollMode === 'scrolled-doc')
  document.getElementById('epub-nav').classList.remove('hidden')
}

// ===== File Handling =====
function openFileInReader(file) {
  currentFile = file
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'txt') {
    textReader = new TextReader()
    showView('text')
    textReader.open(file)
  } else if (ext === 'epub') {
    epubReader = new EpubReader()
    showView('epub')
    epubReader.open(file, {
      fontSize,
      fontFamily: resolveFont(fontFamily),
      lineHeight,
      flowMode: epubScrollMode
    })
  } else {
    alert('지원하지 않는 파일 형식입니다.\n.txt 또는 .epub 파일만 지원합니다.')
  }
}

function handleFile(file) {
  if (!file) return
  openFileInReader(file)
}

// ===== Save File =====
async function handleSave() {
  if (!currentFile) return
  try {
    await saveFile(currentFile)
    showToast('라이브러리에 저장됨')
    // Update save button state
    document.querySelectorAll('.save-btn').forEach(btn => btn.classList.add('saved'))
  } catch (err) {
    showToast('저장 실패')
  }
}

// ===== Delete File =====
function confirmDelete(id, name) {
  const overlay = document.createElement('div')
  overlay.className = 'confirm-overlay'
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p>"${name}" 파일을<br>라이브러리에서 삭제할까요?</p>
      <div class="confirm-actions">
        <button class="confirm-cancel">취소</button>
        <button class="confirm-delete">삭제</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.querySelector('.confirm-cancel').addEventListener('click', () => overlay.remove())
  overlay.querySelector('.confirm-delete').addEventListener('click', async () => {
    await deleteFile(id)
    removeFileFromShelf(id)
    overlay.remove()
    showToast('삭제됨')
    renderLibrary()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

// ===== Library (Saved Files) =====
const bookColors = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400',
  '#16a085', '#2c3e50', '#e74c3c', '#3498db', '#1abc9c'
]
const getColor = (name) => bookColors[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % bookColors.length]
const shortName = (name) => {
  const n = name.replace(/\.(txt|epub)$/i, '')
  return n.length > 12 ? n.slice(0, 12) + '…' : n
}

function renderShelfSection(shelfName, files, shelfId) {
  const dataAttr = shelfId ? `data-shelf-id="${shelfId}"` : 'data-shelf-id="uncategorized"'
  return `
    <div class="shelf-section" ${dataAttr}>
      <div class="shelf-header">
        <h3>${shelfName}</h3>
        <span class="shelf-count">${files.length}권</span>
      </div>
      <div class="bookshelf">
        ${files.length === 0
          ? '<p class="shelf-empty-msg">비어있는 서재</p>'
          : files.map(f => `
            <div class="book" data-id="${f.id}" style="--book-color: ${getColor(f.name)}">
              <div class="book-spine">
                <span class="book-type">${f.type === 'epub' ? 'EPUB' : 'TXT'}</span>
                <span class="book-title">${shortName(f.name)}</span>
              </div>
              <button class="book-delete" data-id="${f.id}" data-name="${f.name}" aria-label="삭제">✕</button>
            </div>
          `).join('')
        }
      </div>
      <div class="shelf-wood"></div>
    </div>
  `
}

let longPressTimer = null

function attachLibraryListeners(container) {
  container.querySelectorAll('.book').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('.book-delete')) return
      const entry = await getFile(el.dataset.id)
      if (entry) {
        openFileInReader(entryToFile(entry))
      } else {
        showToast('파일을 찾을 수 없습니다')
      }
    })

    // Long-press for shelf assignment
    el.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        showShelfPicker(el.dataset.id)
      }, 500)
    }, { passive: true })
    el.addEventListener('touchend', () => clearTimeout(longPressTimer))
    el.addEventListener('touchmove', () => clearTimeout(longPressTimer))

    // Desktop: right-click
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showShelfPicker(el.dataset.id)
    })
  })

  container.querySelectorAll('.book-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      confirmDelete(btn.dataset.id, btn.dataset.name)
    })
  })

  const addBtn = container.querySelector('#add-shelf-btn')
  if (addBtn) addBtn.addEventListener('click', showCreateShelfDialog)

  const manageBtn = container.querySelector('#manage-shelves-btn')
  if (manageBtn) manageBtn.addEventListener('click', showManageShelvesDialog)
}

async function renderLibrary() {
  const container = document.getElementById('library')
  let files
  try {
    files = await listFiles()
  } catch {
    container.innerHTML = ''
    return
  }

  if (files.length === 0) {
    container.innerHTML = `
      <div class="empty-shelf">
        <div class="empty-shelf-icon">📚</div>
        <p class="empty-shelf-text">서재가 비어있습니다</p>
        <p class="empty-shelf-sub">파일을 열고 저장하면 여기에 표시됩니다</p>
      </div>
    `
    return
  }

  const fileMap = new Map(files.map(f => [f.id, f]))
  const shelves = getShelves()

  const assignedIds = new Set()
  shelves.forEach(s => s.fileIds.forEach(id => {
    if (fileMap.has(id)) assignedIds.add(id)
  }))

  const uncategorized = files.filter(f => !assignedIds.has(f.id))

  let html = `
    <div class="library-header">
      <h2>내 서재</h2>
      <div class="library-actions">
        <button id="add-shelf-btn" class="shelf-action-btn">+ 서재</button>
        ${shelves.length > 0 ? '<button id="manage-shelves-btn" class="shelf-action-btn">관리</button>' : ''}
      </div>
    </div>
  `

  shelves.forEach(shelf => {
    const shelfFiles = shelf.fileIds.map(id => fileMap.get(id)).filter(Boolean)
    html += renderShelfSection(shelf.name, shelfFiles, shelf.id)
  })

  if (uncategorized.length > 0 || shelves.length > 0) {
    html += renderShelfSection('미분류', uncategorized, null)
  }

  container.innerHTML = html
  attachLibraryListeners(container)
}

// ===== Shelf Management =====
function showCreateShelfDialog() {
  const overlay = document.createElement('div')
  overlay.className = 'confirm-overlay'
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p class="dialog-title">새 서재</p>
      <input type="text" class="shelf-name-input" placeholder="서재 이름 입력" maxlength="20" />
      <div class="confirm-actions">
        <button class="confirm-cancel">취소</button>
        <button class="confirm-ok">만들기</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const input = overlay.querySelector('.shelf-name-input')
  setTimeout(() => input.focus(), 100)

  overlay.querySelector('.confirm-cancel').addEventListener('click', () => overlay.remove())
  overlay.querySelector('.confirm-ok').addEventListener('click', () => {
    const name = input.value.trim()
    if (name) {
      createShelf(name)
      overlay.remove()
      showToast(`"${name}" 서재 생성됨`)
      renderLibrary()
    }
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('.confirm-ok').click()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

function showShelfPicker(fileId) {
  const shelves = getShelves()
  const currentShelf = getShelfForFile(fileId)

  const overlay = document.createElement('div')
  overlay.className = 'confirm-overlay action-overlay'
  overlay.innerHTML = `
    <div class="action-sheet">
      <div class="action-sheet-title">서재 선택</div>
      <div class="action-sheet-list">
        <button class="action-sheet-item ${!currentShelf ? 'active' : ''}" data-shelf-id="">미분류</button>
        ${shelves.map(s => `
          <button class="action-sheet-item ${currentShelf?.id === s.id ? 'active' : ''}" data-shelf-id="${s.id}">${s.name}</button>
        `).join('')}
      </div>
      <button class="action-sheet-cancel">취소</button>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.querySelectorAll('.action-sheet-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const shelfId = btn.dataset.shelfId
      if (shelfId) {
        addFileToShelf(shelfId, fileId)
      } else {
        removeFileFromShelf(fileId)
      }
      overlay.remove()
      renderLibrary()
    })
  })

  overlay.querySelector('.action-sheet-cancel').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

function showManageShelvesDialog() {
  const shelves = getShelves()

  const overlay = document.createElement('div')
  overlay.className = 'confirm-overlay action-overlay'
  overlay.innerHTML = `
    <div class="action-sheet">
      <div class="action-sheet-title">서재 관리</div>
      <div class="manage-shelves-list">
        ${shelves.map(s => `
          <div class="manage-shelf-item">
            <span class="manage-shelf-name">${s.name}</span>
            <div class="manage-shelf-actions">
              <button class="manage-rename" data-shelf-id="${s.id}" data-name="${s.name}">이름변경</button>
              <button class="manage-delete" data-shelf-id="${s.id}" data-name="${s.name}">삭제</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="action-sheet-cancel">닫기</button>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.querySelectorAll('.manage-rename').forEach(btn => {
    btn.addEventListener('click', () => {
      showRenameShelfDialog(btn.dataset.shelfId, btn.dataset.name, overlay)
    })
  })

  overlay.querySelectorAll('.manage-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteShelf(btn.dataset.shelfId)
      overlay.remove()
      showToast(`"${btn.dataset.name}" 서재 삭제됨`)
      renderLibrary()
    })
  })

  overlay.querySelector('.action-sheet-cancel').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

function showRenameShelfDialog(shelfId, currentName, parentOverlay) {
  if (parentOverlay) parentOverlay.remove()

  const overlay = document.createElement('div')
  overlay.className = 'confirm-overlay'
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p class="dialog-title">서재 이름 변경</p>
      <input type="text" class="shelf-name-input" value="${currentName}" maxlength="20" />
      <div class="confirm-actions">
        <button class="confirm-cancel">취소</button>
        <button class="confirm-ok">변경</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const input = overlay.querySelector('.shelf-name-input')
  setTimeout(() => { input.focus(); input.select() }, 100)

  overlay.querySelector('.confirm-cancel').addEventListener('click', () => overlay.remove())
  overlay.querySelector('.confirm-ok').addEventListener('click', () => {
    const name = input.value.trim()
    if (name) {
      renameShelf(shelfId, name)
      overlay.remove()
      showToast('이름 변경됨')
      renderLibrary()
    }
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('.confirm-ok').click()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

// ===== Drag and Drop =====
function setupDragDrop() {
  const dropZone = document.getElementById('drop-zone')
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover') })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover')
    handleFile(e.dataTransfer.files[0])
  })
}

// ===== Init =====
function init() {
  initTheme()
  document.documentElement.style.setProperty('--font-size', `${fontSize}px`)
  document.documentElement.style.setProperty('--font-family', resolveFont(fontFamily))
  document.documentElement.style.setProperty('--line-height', lineHeight.toString())
  syncSettingsUI()

  // File input
  document.getElementById('file-input').addEventListener('change', (e) => {
    handleFile(e.target.files[0])
    e.target.value = ''
  })

  // Theme toggles
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
  document.getElementById('text-theme').addEventListener('click', toggleTheme)
  document.getElementById('epub-theme').addEventListener('click', toggleTheme)

  // Back buttons
  document.getElementById('text-back').addEventListener('click', goHome)
  document.getElementById('epub-back').addEventListener('click', goHome)

  // Save buttons
  document.getElementById('text-save').addEventListener('click', handleSave)
  document.getElementById('epub-save').addEventListener('click', handleSave)

  // Text Settings Panel
  document.getElementById('text-settings-btn').addEventListener('click', () => { syncSettingsUI(); openSettings('text-settings') })
  document.getElementById('text-settings-close').addEventListener('click', () => closeSettings('text-settings'))
  document.getElementById('text-settings').addEventListener('click', (e) => {
    if (e.target.classList.contains('settings-overlay')) closeSettings('text-settings')
  })

  // EPUB Settings Panel
  document.getElementById('epub-settings-btn').addEventListener('click', () => { syncSettingsUI(); openSettings('epub-settings') })
  document.getElementById('epub-settings-close').addEventListener('click', () => closeSettings('epub-settings'))
  document.getElementById('epub-settings').addEventListener('click', (e) => {
    if (e.target.classList.contains('settings-overlay')) closeSettings('epub-settings')
  })

  // Font Size
  document.querySelectorAll('.size-slider[id$="font-range"]').forEach(slider => {
    slider.addEventListener('input', (e) => setFontSize(parseInt(e.target.value)))
  })
  document.querySelectorAll('.size-btn[data-delta]').forEach(btn => {
    btn.addEventListener('click', () => setFontSize(fontSize + parseInt(btn.dataset.delta)))
  })

  // Line Height
  document.querySelectorAll('.size-slider[id$="lh-range"]').forEach(slider => {
    slider.addEventListener('input', (e) => setLineHeight(parseFloat(e.target.value)))
  })

  // Font Family
  document.querySelectorAll('.font-list').forEach(list => {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.font-item')
      if (btn) setFontFamily(btn.dataset.font)
    })
  })

  // EPUB Scroll Mode
  document.getElementById('epub-mode-page').addEventListener('click', () => setEpubScrollMode('paginated'))
  document.getElementById('epub-mode-scroll').addEventListener('click', () => setEpubScrollMode('scrolled-doc'))

  // EPUB Navigation
  document.getElementById('epub-prev').addEventListener('click', () => epubReader?.prev())
  document.getElementById('epub-next').addEventListener('click', () => epubReader?.next())

  // EPUB TOC
  document.getElementById('epub-toc-btn').addEventListener('click', () => epubReader?.openToc())
  document.getElementById('toc-close').addEventListener('click', () => epubReader?.closeToc())
  document.getElementById('toc-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('toc-overlay')) epubReader?.closeToc()
  })

  setupDragDrop()
  renderLibrary()
}

init()
