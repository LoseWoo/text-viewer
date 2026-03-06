import ePub from 'epubjs'

export class EpubReader {
  constructor() {
    this.containerEl = document.getElementById('epub-container')
    this.titleEl = document.getElementById('epub-title')
    this.progressText = document.getElementById('epub-progress-text')
    this.progressFill = document.querySelector('#epub-progress .progress-fill')
    this.tocList = document.getElementById('toc-list')
    this.tocOverlay = document.getElementById('toc-overlay')

    this.book = null
    this.rendition = null
    this.fileName = ''
    this._currentFontFamily = ''
    this._currentFontSize = 17
    this._currentLineHeight = 1.8
    this._flowMode = 'scrolled-doc'
    this._touchStartX = 0
    this._touchStartY = 0

    this._saveCfiTimer = null

    this._onTouchStart = this._handleTouchStart.bind(this)
    this._onTouchEnd = this._handleTouchEnd.bind(this)
    this._onContainerScroll = this._handleContainerScroll.bind(this)
  }

  async open(file, options = {}) {
    this.fileName = file.name
    this.titleEl.textContent = file.name

    this._currentFontSize = options.fontSize || 17
    this._currentFontFamily = options.fontFamily || ''
    this._currentLineHeight = options.lineHeight || 1.8
    this._flowMode = options.flowMode || 'paginated'

    const buffer = await file.arrayBuffer()

    this.book = ePub(buffer)
    this.rendition = this.book.renderTo(this.containerEl, {
      width: '100%',
      height: '100%',
      flow: this._flowMode,
      spread: 'none'
    })

    this._applyAllStyles()

    const savedCfi = this._getSavedCfi()
    await this.rendition.display(savedCfi || undefined)

    await this.book.locations.generate(1024)

    const nav = await this.book.loaded.navigation
    this._buildToc(nav.toc)

    this.rendition.on('relocated', (location) => this._onRelocated(location))

    const meta = await this.book.loaded.metadata
    if (meta.title) this.titleEl.textContent = meta.title

    this.containerEl.addEventListener('touchstart', this._onTouchStart, { passive: true })
    this.containerEl.addEventListener('touchend', this._onTouchEnd, { passive: false })

    if (this._flowMode === 'scrolled-doc') {
      this.containerEl.addEventListener('scroll', this._onContainerScroll, { passive: true })
    }
  }

  prev() {
    if (!this.rendition || !this.book) return
    if (this._flowMode === 'scrolled-doc') {
      const loc = this.rendition.currentLocation()
      const currentHref = loc?.start?.href
      if (!currentHref) return
      const spine = this.book.spine
      const idx = spine.items.findIndex(item => item.href === currentHref)
      if (idx > 0) {
        this.rendition.display(spine.items[idx - 1].href).then(() => {
          this.containerEl.scrollTop = 0
        })
      }
    } else {
      this.rendition.prev()
    }
  }

  next() {
    if (!this.rendition || !this.book) return
    if (this._flowMode === 'scrolled-doc') {
      const loc = this.rendition.currentLocation()
      const currentHref = loc?.start?.href
      if (!currentHref) return
      const spine = this.book.spine
      const idx = spine.items.findIndex(item => item.href === currentHref)
      if (idx >= 0 && idx < spine.items.length - 1) {
        this.rendition.display(spine.items[idx + 1].href).then(() => {
          this.containerEl.scrollTop = 0
        })
      }
    } else {
      this.rendition.next()
    }
  }

  goTo(href) {
    if (this.rendition) {
      this.rendition.display(href)
      this.closeToc()
    }
  }

  openToc() {
    this.tocOverlay.classList.remove('hidden')
  }

  closeToc() {
    this.tocOverlay.classList.add('hidden')
  }

  // ===== Style Application =====

  applyFontSize(size) {
    this._currentFontSize = size
    if (this.rendition) {
      this.rendition.themes.fontSize(`${size}px`)
    }
  }

  applyFontFamily(family) {
    this._currentFontFamily = family
    this._applyAllStyles()
    this._forceRedraw()
  }

  applyLineHeight(lh) {
    this._currentLineHeight = lh
    this._applyAllStyles()
    this._forceRedraw()
  }

  setFlowMode(mode) {
    if (!this.rendition || this._flowMode === mode) return
    this._flowMode = mode

    const currentCfi = this._getCurrentCfi()

    this.rendition.destroy()
    this.containerEl.innerHTML = ''

    this.rendition = this.book.renderTo(this.containerEl, {
      width: '100%',
      height: '100%',
      flow: mode,
      spread: 'none'
    })

    this._applyAllStyles()

    this.rendition.on('relocated', (location) => this._onRelocated(location))

    this.rendition.display(currentCfi || undefined)

    // Re-attach swipe
    this.containerEl.addEventListener('touchstart', this._onTouchStart, { passive: true })
    this.containerEl.addEventListener('touchend', this._onTouchEnd, { passive: false })

    // Scroll progress for scrolled-doc mode
    this.containerEl.removeEventListener('scroll', this._onContainerScroll)
    if (mode === 'scrolled-doc') {
      this.containerEl.addEventListener('scroll', this._onContainerScroll, { passive: true })
    }
  }

  updateTheme() {
    this._applyAllStyles()
    this._forceRedraw()
  }

  _applyAllStyles() {
    if (!this.rendition) return

    const isDark = document.documentElement.dataset.theme === 'dark'
    const ff = this._currentFontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

    this.rendition.themes.default({
      'body': {
        'color': isDark ? '#e5e5e7 !important' : '#1a1a1a !important',
        'background': isDark ? '#000000 !important' : '#ffffff !important',
        'font-family': `${ff} !important`,
        'font-size': `${this._currentFontSize}px !important`,
        'line-height': `${this._currentLineHeight} !important`,
        'padding': '0 16px !important',
        'word-break': 'keep-all !important'
      },
      'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': {
        'font-family': `${ff} !important`,
        'line-height': `${this._currentLineHeight} !important`
      },
      'a': {
        'color': isDark ? '#0a84ff !important' : '#007aff !important'
      },
      'img': {
        'max-width': '100% !important',
        'height': 'auto !important'
      }
    })
  }

  _forceRedraw() {
    if (!this.rendition) return
    if (this._flowMode === 'scrolled-doc') {
      // In scroll mode, don't call display(cfi) as it resets scroll position
      // Instead, just let the styles apply naturally
      const scrollTop = this.containerEl.scrollTop
      requestAnimationFrame(() => {
        this.containerEl.scrollTop = scrollTop
      })
      return
    }
    const cfi = this._getCurrentCfi()
    if (cfi) this.rendition.display(cfi)
  }

  _getCurrentCfi() {
    if (!this.rendition) return null
    const loc = this.rendition.currentLocation()
    return loc?.start?.cfi || null
  }

  _onRelocated(location) {
    if (location && location.start) {
      const progress = this.book.locations.percentageFromCfi(location.start.cfi)
      const pct = Math.round(progress * 100)
      // Only update progress in paginated mode (scroll mode uses scroll handler)
      if (this._flowMode === 'paginated') {
        this.progressText.textContent = `${pct}%`
        this.progressFill.style.width = `${pct}%`
      }
      // Debounce CFI save to avoid excessive writes
      clearTimeout(this._saveCfiTimer)
      this._saveCfiTimer = setTimeout(() => {
        this._saveCfi(location.start.cfi)
      }, 500)
    }
  }

  _buildToc(toc) {
    this.tocList.innerHTML = ''
    toc.forEach(item => {
      const li = document.createElement('li')
      li.textContent = item.label.trim()
      li.addEventListener('click', () => this.goTo(item.href))
      this.tocList.appendChild(li)

      if (item.subitems && item.subitems.length > 0) {
        item.subitems.forEach(sub => {
          const subLi = document.createElement('li')
          subLi.textContent = `  ${sub.label.trim()}`
          subLi.style.paddingLeft = '32px'
          subLi.style.fontSize = '14px'
          subLi.addEventListener('click', () => this.goTo(sub.href))
          this.tocList.appendChild(subLi)
        })
      }
    })
  }

  _handleContainerScroll() {
    const el = this.containerEl
    const scrollTop = el.scrollTop
    const scrollHeight = el.scrollHeight - el.clientHeight
    if (scrollHeight > 0) {
      const pct = Math.round((scrollTop / scrollHeight) * 100)
      this.progressText.textContent = `${pct}%`
      this.progressFill.style.width = `${pct}%`
    }
  }

  _handleTouchStart(e) {
    this._touchStartX = e.changedTouches[0].clientX
    this._touchStartY = e.changedTouches[0].clientY
  }

  _handleTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this._touchStartX
    const dy = e.changedTouches[0].clientY - this._touchStartY

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) this.prev()
      else this.next()
      e.preventDefault()
    }
  }

  _saveCfi(cfi) {
    localStorage.setItem(`textv_epub_${this.fileName}`, cfi)
  }

  _getSavedCfi() {
    return localStorage.getItem(`textv_epub_${this.fileName}`)
  }

  destroy() {
    clearTimeout(this._saveCfiTimer)
    this.containerEl.removeEventListener('touchstart', this._onTouchStart)
    this.containerEl.removeEventListener('touchend', this._onTouchEnd)
    this.containerEl.removeEventListener('scroll', this._onContainerScroll)
    if (this.rendition) { this.rendition.destroy(); this.rendition = null }
    if (this.book) { this.book.destroy(); this.book = null }
    this.containerEl.innerHTML = ''
    this.tocList.innerHTML = ''
    this.progressText.textContent = '0%'
    this.progressFill.style.width = '0%'
    this.closeToc()
  }
}
