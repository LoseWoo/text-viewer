export class TextReader {
  constructor() {
    this.contentEl = document.getElementById('text-content')
    this.titleEl = document.getElementById('text-title')
    this.progressFill = document.querySelector('#text-progress .progress-fill')
    this.fileName = ''
    this._onScroll = this._handleScroll.bind(this)
  }

  open(file) {
    this.fileName = file.name
    this.titleEl.textContent = file.name

    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target.result
      const text = this._decode(buffer)
      this._render(text)
      this._restorePosition()
    }
    reader.readAsArrayBuffer(file)
  }

  _decode(buffer) {
    const bytes = new Uint8Array(buffer)

    // BOM detection
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(buffer)
    }
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(buffer)
    }

    // Try UTF-8 first
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      return text
    } catch {
      // Fallback to EUC-KR for Korean text files
      try {
        return new TextDecoder('euc-kr').decode(buffer)
      } catch {
        return new TextDecoder('utf-8').decode(buffer)
      }
    }
  }

  _render(text) {
    this.contentEl.innerHTML = ''

    // Split into paragraphs, preserve empty lines
    const paragraphs = text.split(/\n\n+/)

    if (paragraphs.length <= 1) {
      // Single block — use <pre> for plain text
      const pre = document.createElement('pre')
      pre.textContent = text
      this.contentEl.appendChild(pre)
    } else {
      paragraphs.forEach(para => {
        const p = document.createElement('p')
        p.textContent = para.trim()
        if (p.textContent) {
          this.contentEl.appendChild(p)
        }
      })
    }

    // Listen for scroll to track progress
    this.contentEl.removeEventListener('scroll', this._onScroll)
    this.contentEl.addEventListener('scroll', this._onScroll, { passive: true })
  }

  _handleScroll() {
    const el = this.contentEl
    const scrollTop = el.scrollTop
    const scrollHeight = el.scrollHeight - el.clientHeight
    const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0

    this.progressFill.style.width = `${Math.round(progress * 100)}%`

    // Save position
    this._savePosition(scrollTop)
  }

  _savePosition(scrollTop) {
    const key = `textv_pos_${this.fileName}`
    localStorage.setItem(key, JSON.stringify({
      scrollTop,
      timestamp: Date.now()
    }))
  }

  _restorePosition() {
    const key = `textv_pos_${this.fileName}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const { scrollTop } = JSON.parse(saved)
        requestAnimationFrame(() => {
          this.contentEl.scrollTop = scrollTop
        })
      } catch { /* ignore */ }
    }
  }

  destroy() {
    this.contentEl.removeEventListener('scroll', this._onScroll)
    this.contentEl.innerHTML = ''
    this.progressFill.style.width = '0%'
  }
}
