import type { PanelSettings, SettingsScope } from '../../shared/types'
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_DISPLAY_NAMES,
  flagAsset,
  type AppLocale,
  t
} from '../../shared/i18n'

const opacityInput = document.querySelector<HTMLInputElement>('#opacity')!
const opacityValue = document.querySelector<HTMLOutputElement>('#opacity-value')!
const fontSizeSelect = document.querySelector<HTMLSelectElement>('#font-size')!
const closeBtn = document.querySelector<HTMLButtonElement>('#btn-close')!
const localeBtn = document.querySelector<HTMLButtonElement>('#btn-locale')!
const localeFlag = document.querySelector<HTMLImageElement>('#locale-flag')!
const localePanel = document.querySelector<HTMLElement>('#locale-panel')!
const localeList = document.querySelector<HTMLUListElement>('#locale-list')!
const brandEl = document.querySelector<HTMLElement>('.brand')!
const hintEl = document.querySelector<HTMLElement>('.hint')!
const shell = document.querySelector<HTMLElement>('.settings-shell')!

let scope: SettingsScope = 'app'
let locale: AppLocale = DEFAULT_LOCALE
let localeOpen = false

function tr(key: Parameters<typeof t>[1], vars?: Record<string, string | number>): string {
  return t(locale, key, vars)
}

function applySettings(next: PanelSettings): void {
  opacityInput.value = String(Math.round(next.opacity * 100))
  opacityValue.textContent = `${Math.round(next.opacity * 100)}%`
  fontSizeSelect.value = String(next.fontSize)
  document.documentElement.style.fontSize = `${next.fontSize}px`
  void fitSettingsWindow()
}

function applyScope(next: SettingsScope): void {
  scope = next
  applyStaticCopy()
}

function applyStaticCopy(): void {
  brandEl.textContent = tr(scope === 'overlay' ? 'settings.brandOverlay' : 'settings.brandApp')
  hintEl.textContent = tr(scope === 'overlay' ? 'settings.hintOverlay' : 'settings.hintApp')
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (!key) return
    if (el === brandEl || el === hintEl) return
    el.textContent = tr(key as Parameters<typeof t>[1])
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle
    if (!key) return
    el.title = tr(key as Parameters<typeof t>[1])
  })
  localeBtn.title = tr('app.language')
  localeBtn.setAttribute('aria-label', tr('app.language'))
  localeFlag.src = flagAsset(locale)
  localeFlag.alt = LOCALE_DISPLAY_NAMES[locale]
  renderLocaleList()
  void fitSettingsWindow()
}

function renderLocaleList(): void {
  localeList.innerHTML = APP_LOCALES.map((code) => {
    const active = code === locale ? 'active' : ''
    return `
      <li>
        <button type="button" class="locale-option ${active}" data-locale="${code}" role="option" aria-selected="${code === locale}">
          <img class="flag-img" src="${flagAsset(code)}" alt="" width="20" height="14" />
          <span class="locale-name">${LOCALE_DISPLAY_NAMES[code]}</span>
        </button>
      </li>
    `
  }).join('')

  localeList.querySelectorAll<HTMLButtonElement>('button[data-locale]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.locale as AppLocale
      void chooseLocale(next)
    })
  })
}

function setLocalePanelOpen(open: boolean): void {
  localeOpen = open
  localePanel.hidden = !open
  localeBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
  void fitSettingsWindow()
}

async function chooseLocale(next: AppLocale): Promise<void> {
  if (next === locale) {
    setLocalePanelOpen(false)
    return
  }
  locale = await window.spellTimer.setLocale(next)
  applyStaticCopy()
  setLocalePanelOpen(false)
}

async function fitSettingsWindow(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  const rect = shell.getBoundingClientRect()
  const width = Math.ceil(Math.max(shell.scrollWidth, rect.width) + 2)
  const height = Math.ceil(Math.max(shell.scrollHeight, rect.height) + 2)
  if (width < 100 || height < 80) return
  await window.spellTimer.fitWindow({ width, height })
}

async function reload(): Promise<void> {
  applySettings(await window.spellTimer.getSettings(scope))
}

async function init(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  scope = params.get('scope') === 'overlay' ? 'overlay' : 'app'
  locale = await window.spellTimer.getLocale()
  applyScope(scope)
  await reload()

  window.spellTimer.onSettingsScope((next) => {
    applyScope(next)
    void reload()
  })

  window.spellTimer.onSettingsChanged((payload) => {
    if (payload.scope === scope) applySettings(payload.settings)
  })

  window.spellTimer.onLocaleChanged((next) => {
    locale = next
    applyStaticCopy()
  })

  opacityInput.addEventListener('input', () => {
    const value = Number(opacityInput.value)
    opacityValue.textContent = `${value}%`
    void window.spellTimer.updateSettings(scope, { opacity: value / 100 })
  })

  fontSizeSelect.addEventListener('change', () => {
    void window.spellTimer.updateSettings(scope, { fontSize: Number(fontSizeSelect.value) })
  })

  localeBtn.addEventListener('click', () => {
    setLocalePanelOpen(!localeOpen)
  })

  closeBtn.addEventListener('click', () => window.spellTimer.closeSettings())
}

void init()
