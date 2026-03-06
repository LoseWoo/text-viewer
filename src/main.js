import './style.css'
import { TextReader } from './TextReader.js'
import { EpubReader } from './EpubReader.js'
import { saveFile, getFile, deleteFile, listFiles, entryToFile } from './FileStorage.js'

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
    overlay.remove()
    showToast('삭제됨')
    renderLibrary()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
}

// ===== Library (Saved Files) =====
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
    container.innerHTML = ''
    return
  }

  const icon = (type) => type === 'epub' ? '📕' : '📄'
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  const timeAgo = (ts) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '방금 전'
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  container.innerHTML = `
    <h3>라이브러리</h3>
    ${files.map(f => `
      <div class="library-item" data-id="${f.id}">
        <div class="library-item-body" data-id="${f.id}">
          <span class="library-icon">${icon(f.type)}</span>
          <div class="library-info">
            <div class="library-name">${f.name}</div>
            <div class="library-meta">${formatSize(f.size)} · ${timeAgo(f.savedAt)}</div>
          </div>
        </div>
        <button class="library-delete" data-id="${f.id}" data-name="${f.name}" aria-label="삭제">✕</button>
      </div>
    `).join('')}
  `

  // Open saved file
  container.querySelectorAll('.library-item-body').forEach(el => {
    el.addEventListener('click', async () => {
      const entry = await getFile(el.dataset.id)
      if (entry) {
        const file = entryToFile(entry)
        openFileInReader(file)
      } else {
        showToast('파일을 찾을 수 없습니다')
      }
    })
  })

  // Delete
  container.querySelectorAll('.library-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      confirmDelete(btn.dataset.id, btn.dataset.name)
    })
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
