import { REGIONS } from '../../shared/regions'
import {
  DEFAULT_LOCALE,
  type AppLocale,
  type MessageKey,
  t
} from '../../shared/i18n'
import type { PlatformRegion, UserConfig } from '../../shared/types'

const gameNameInput = document.querySelector<HTMLInputElement>('#game-name')!
const tagLineInput = document.querySelector<HTMLInputElement>('#tag-line')!
const regionSelect = document.querySelector<HTMLSelectElement>('#region')!
const apiKeyInput = document.querySelector<HTMLInputElement>('#api-key')!
const toggleApiKeyBtn = document.querySelector<HTMLButtonElement>('#btn-toggle-api-key')!
const saveBtn = document.querySelector<HTMLButtonElement>('#btn-save')!
const deleteBtn = document.querySelector<HTMLButtonElement>('#btn-delete')!
const closeBtn = document.querySelector<HTMLButtonElement>('#btn-close')!
const brandEl = document.querySelector<HTMLElement>('#brand')!
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!
const shell = document.querySelector<HTMLElement>('.profile-shell')!

type EditorMode = 'edit' | 'new'

let locale: AppLocale = DEFAULT_LOCALE
let mode: EditorMode = 'edit'
let profileId: string | null = null

function tr(key: MessageKey, vars?: Record<string, string | number>): string {
  return t(locale, key, vars)
}

function setStatus(key: MessageKey, kind: '' | 'ok' | 'error' = '', vars?: Record<string, string | number>): void {
  statusEl.textContent = tr(key, vars)
  statusEl.className = `status${kind ? ` ${kind}` : ''}`
}

function setStatusRaw(message: string, kind: '' | 'ok' | 'error' = ''): void {
  statusEl.textContent = message
  statusEl.className = `status${kind ? ` ${kind}` : ''}`
}

async function fitProfileWindow(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  const rect = shell.getBoundingClientRect()
  const width = Math.ceil(Math.max(shell.scrollWidth, rect.width) + 2)
  const height = Math.ceil(Math.max(shell.scrollHeight, rect.height) + 2)
  if (width < 100 || height < 80) return
  await window.spellTimer.fitWindow({ width, height })
}

function fillRegions(): void {
  const current = regionSelect.value || 'br1'
  regionSelect.innerHTML = REGIONS.map((region) => {
    const key = `region.${region.id}` as MessageKey
    return `<option value="${region.id}">${tr(key)} (${region.id})</option>`
  }).join('')
  regionSelect.value = current
}

function applyConfig(config: UserConfig): void {
  gameNameInput.value = config.gameName
  tagLineInput.value = config.tagLine
  if (REGIONS.some((region) => region.id === config.platform)) {
    regionSelect.value = config.platform
  } else {
    regionSelect.value = 'br1'
  }
  apiKeyInput.value = config.apiKey
}

function readConfig(): UserConfig {
  return {
    gameName: gameNameInput.value,
    tagLine: tagLineInput.value,
    platform: regionSelect.value as PlatformRegion,
    apiKey: apiKeyInput.value
  }
}

function applyStaticI18n(): void {
  brandEl.textContent = tr(mode === 'new' ? 'app.newProfile' : 'profile.brandEdit')
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    if (el === brandEl) return
    const key = el.dataset.i18n as MessageKey | undefined
    if (key) el.textContent = tr(key)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle as MessageKey | undefined
    if (key) el.title = tr(key)
  })
  const showKey = apiKeyInput.type === 'password'
  toggleApiKeyBtn.textContent = showKey ? tr('app.show') : tr('app.hide')
  fillRegions()
  void fitProfileWindow()
}

async function loadEditorState(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  mode = params.get('mode') === 'new' ? 'new' : 'edit'
  profileId = params.get('profileId')?.trim() || null

  deleteBtn.hidden = mode === 'new'

  if (mode === 'new') {
    applyConfig({ gameName: '', tagLine: '', platform: 'br1', apiKey: '' })
    setStatus('profile.newHint', 'ok')
    applyStaticI18n()
    gameNameInput.focus()
    return
  }

  const state = await window.spellTimer.getProfiles()
  const id = profileId || state.lastProfileId
  const profile = id ? state.profiles.find((p) => p.id === id) : null
  if (!profile) {
    applyConfig({ gameName: '', tagLine: '', platform: 'br1', apiKey: '' })
    profileId = null
    deleteBtn.hidden = true
    setStatus('profile.select', 'error')
    applyStaticI18n()
    return
  }

  profileId = profile.id
  applyConfig({
    gameName: profile.gameName,
    tagLine: profile.tagLine,
    platform: profile.platform,
    apiKey: profile.apiKey
  })
  statusEl.textContent = ''
  statusEl.className = 'status'
  applyStaticI18n()
  gameNameInput.focus()
}

async function saveProfile(): Promise<void> {
  saveBtn.disabled = true
  deleteBtn.disabled = true
  setStatus('profile.saving')
  try {
    const config = readConfig()
    const creating = mode === 'new'
    const result = await window.spellTimer.saveProfile({
      gameName: config.gameName,
      tagLine: config.tagLine,
      platform: config.platform,
      apiKey: config.apiKey,
      profileId: creating ? null : profileId,
      createProfile: creating
    })
    if (!result.ok) {
      setStatusRaw(result.error, 'error')
      return
    }

    setStatus('match.fetching')
    const loaded = await window.spellTimer.loadMatch({
      gameName: config.gameName,
      tagLine: config.tagLine,
      platform: config.platform,
      apiKey: config.apiKey,
      openOverlay: false
    })
    if (!loaded.ok) {
      setStatusRaw(loaded.error, 'error')
      return
    }

    window.spellTimer.close()
  } finally {
    saveBtn.disabled = false
    deleteBtn.disabled = false
  }
}

async function deleteCurrent(): Promise<void> {
  if (mode === 'new' || !profileId) {
    setStatus('profile.selectToDelete', 'error')
    return
  }
  const label = `${gameNameInput.value.trim()}#${tagLineInput.value.trim()}`
  const ok = window.confirm(tr('profile.deleteConfirm', { label }))
  if (!ok) return

  saveBtn.disabled = true
  deleteBtn.disabled = true
  try {
    const result = await window.spellTimer.deleteProfile(profileId)
    if (!result.ok) {
      setStatus('profile.cannotDelete', 'error')
      return
    }
    window.spellTimer.close()
  } finally {
    saveBtn.disabled = false
    deleteBtn.disabled = false
  }
}

async function init(): Promise<void> {
  locale = await window.spellTimer.getLocale()
  fillRegions()
  await loadEditorState()

  const settings = await window.spellTimer.getSettings('app')
  document.documentElement.style.fontSize = `${settings.fontSize}px`
  void fitProfileWindow()

  window.spellTimer.onLocaleChanged((next) => {
    locale = next
    applyStaticI18n()
  })

  window.spellTimer.onSettingsChanged((payload) => {
    if (payload.scope !== 'app') return
    document.documentElement.style.fontSize = `${payload.settings.fontSize}px`
    void fitProfileWindow()
  })

  toggleApiKeyBtn.addEventListener('click', () => {
    const show = apiKeyInput.type === 'password'
    apiKeyInput.type = show ? 'text' : 'password'
    toggleApiKeyBtn.textContent = show ? tr('app.hide') : tr('app.show')
    toggleApiKeyBtn.setAttribute('aria-pressed', show ? 'true' : 'false')
  })

  saveBtn.addEventListener('click', () => void saveProfile())
  deleteBtn.addEventListener('click', () => void deleteCurrent())
  closeBtn.addEventListener('click', () => window.spellTimer.close())
}

void init()
