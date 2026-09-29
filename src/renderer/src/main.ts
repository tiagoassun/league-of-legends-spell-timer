import { REGIONS } from '../../shared/regions'
import {
  bcp47,
  DEFAULT_LOCALE,
  type AppLocale,
  type MessageKey,
  t
} from '../../shared/i18n'
import type {
  ActiveMatchPayload,
  MatchBundle,
  MatchSlot,
  PanelSettings,
  PlatformRegion,
  ProfilesState,
  SavedProfile,
  UserConfig
} from '../../shared/types'

function recentSlot(index: number): MatchSlot {
  return `r${index}` as MatchSlot
}

const fetchMatchesBtn = document.querySelector<HTMLButtonElement>('#btn-fetch-matches')!
const editProfileBtn = document.querySelector<HTMLButtonElement>('#btn-edit-profile')!
const newProfileBtn = document.querySelector<HTMLButtonElement>('#btn-new-profile')!
const profilePickerBtn = document.querySelector<HTMLButtonElement>('#btn-profile-picker')!
const profileSummary = document.querySelector<HTMLElement>('#profile-summary')!
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!
const configBtn = document.querySelector<HTMLButtonElement>('#btn-config')!
const minBtn = document.querySelector<HTMLButtonElement>('#btn-min')!
const closeBtn = document.querySelector<HTMLButtonElement>('#btn-close')!
const shell = document.querySelector<HTMLElement>('#app')!
const matchBoard = document.querySelector<HTMLElement>('#match-board')!
const matchCards = document.querySelector<HTMLElement>('#match-cards')!
const profileList = document.querySelector<HTMLUListElement>('#profile-list')!

let settings: PanelSettings = { locked: false, opacity: 1, fontSize: 16 }
let locale: AppLocale = DEFAULT_LOCALE
let overlayOpen = false
let bundle: MatchBundle = { live: null, recent: [] }
let selectedSlot: MatchSlot | null = null
let profiles: SavedProfile[] = []
let lastProfileId: string | null = null
/** Perfil selecionado na janela principal. */
let selectedProfileId: string | null = null
let currentUserConfig: UserConfig = {
  gameName: '',
  tagLine: '',
  platform: 'br1',
  apiKey: ''
}
let profileListOpen = false
let profileHighlight = -1
let bootLoading = false

function tr(key: MessageKey, vars?: Record<string, string | number>): string {
  return t(locale, key, vars)
}

type StatusKind = '' | 'ok' | 'error'

type StatusState =
  | { mode: 'i18n'; key: MessageKey; vars?: Record<string, string | number>; kind: StatusKind }
  | { mode: 'raw'; message: string; kind: StatusKind }

let statusState: StatusState | null = null

function paintStatus(): void {
  if (!statusState) {
    statusEl.textContent = ''
    statusEl.className = 'status'
    return
  }
  const message =
    statusState.mode === 'i18n' ? tr(statusState.key, statusState.vars) : statusState.message
  statusEl.textContent = message
  statusEl.className = `status${statusState.kind ? ` ${statusState.kind}` : ''}`
}

/** Status traduzivel: reaplicado ao trocar o idioma. */
function setStatus(
  key: MessageKey,
  kind: StatusKind = '',
  vars?: Record<string, string | number>
): void {
  statusState = { mode: 'i18n', key, kind, vars }
  paintStatus()
}

/** Erro/texto ja resolvido (ex.: IPC): nao re-traduz na troca de idioma. */
function setStatusRaw(message: string, kind: StatusKind = ''): void {
  statusState = { mode: 'raw', message, kind }
  paintStatus()
}

function cardLabel(match: ActiveMatchPayload, recentIndex?: number): string {
  if (match.source === 'live') return tr('match.live')
  if (recentIndex === 0) return tr('match.last')
  if (recentIndex === 1) return tr('match.previous')
  if (typeof recentIndex === 'number') return tr('match.older')
  return tr('match.match')
}

function formatMatchWhen(timestamp: number): string {
  if (!timestamp || Number.isNaN(timestamp)) return tr('match.timeUnavailable')
  return new Date(timestamp).toLocaleString(bcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function translatedQueue(match: ActiveMatchPayload): string {
  const known: Record<number, MessageKey> = {
    400: 'queue.400',
    420: 'queue.420',
    430: 'queue.430',
    440: 'queue.440',
    450: 'queue.450',
    480: 'queue.480',
    490: 'queue.490',
    700: 'queue.700'
  }
  if (typeof match.queueId === 'number' && known[match.queueId]) {
    return tr(known[match.queueId])
  }
  if (match.gameMode === 'ARAM') return tr('queue.ARAM')
  if (match.gameMode === 'CLASSIC') return tr('queue.classic')
  return match.queueLabel || match.gameMode || tr('match.match')
}

function cardMeta(match: ActiveMatchPayload): string {
  return `${translatedQueue(match)} - ${formatMatchWhen(match.gameStartTime)}`
}

function matchCardHtml(
  slot: MatchSlot,
  match: ActiveMatchPayload | null,
  selected: boolean,
  open: boolean,
  recentIndex?: number
): string {
  if (!match) {
    return `
      <button type="button" class="match-card" data-slot="${slot}" disabled>
        <div class="match-card-head">
          <span class="match-card-label">${tr('match.live')}</span>
        </div>
        <p class="match-card-empty">${tr('match.noneAvailable')}</p>
      </button>
    `
  }

  const active = selected && open
  const champs = match.enemies
    .map(
      (enemy) =>
        `<img src="${enemy.championIconUrl}" alt="${enemy.championName}" title="${enemy.championName}" />`
    )
    .join('')

  return `
    <button
      type="button"
      class="match-card ${active ? 'selected' : ''}"
      data-slot="${slot}"
      aria-pressed="${active ? 'true' : 'false'}"
      title="${active ? tr('match.closeOverlay') : tr('match.openOverlay')}"
    >
      <div class="match-card-head">
        <span class="match-card-label">${cardLabel(match, recentIndex)}</span>
        <span class="match-card-meta">${cardMeta(match)}</span>
      </div>
      <div class="match-card-champs">${champs}</div>
    </button>
  `
}

function renderMatchCards(): void {
  const hasAny = Boolean(bundle.live || bundle.recent.length)
  matchBoard.hidden = !hasAny
  if (!hasAny) {
    matchCards.innerHTML = ''
    void fitMainWindow()
    return
  }

  const parts: string[] = [
    matchCardHtml('live', bundle.live, selectedSlot === 'live', overlayOpen)
  ]

  bundle.recent.forEach((match, index) => {
    const slot = recentSlot(index)
    parts.push(matchCardHtml(slot, match, selectedSlot === slot, overlayOpen, index))
  })

  matchCards.innerHTML = parts.join('')

  matchCards.querySelectorAll<HTMLButtonElement>('.match-card').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return
      const slot = button.dataset.slot as MatchSlot
      void toggleMatchSlot(slot)
    })
  })

  void fitMainWindow()
}

async function waitForImages(): Promise<void> {
  const images = Array.from(shell.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
    )
  )
}

async function fitMainWindow(): Promise<void> {
  await waitForImages()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  const rect = shell.getBoundingClientRect()
  const width = Math.ceil(Math.max(shell.scrollWidth, rect.width) + 2)
  const height = Math.ceil(Math.max(shell.scrollHeight, rect.height) + 2)
  if (height < 100 || width < 100) return
  await window.spellTimer.fitWindow({ width, height })
}

function applyBundleState(state: {
  bundle: MatchBundle
  selectedSlot: MatchSlot | null
}): void {
  bundle = {
    live: state.bundle.live ?? null,
    recent: state.bundle.recent ?? []
  }
  selectedSlot = state.selectedSlot
  renderMatchCards()
  if (bootLoading && (bundle.live || bundle.recent.length)) {
    bootLoading = false
    const n = bundle.recent.length
    if (bundle.live) setStatus('profile.updatedLive', 'ok', { n })
    else setStatus('profile.updatedRecent', 'ok', { n })
  }
}

async function toggleMatchSlot(slot: MatchSlot): Promise<void> {
  const state = await window.spellTimer.getOverlayState()
  const bundleState = await window.spellTimer.getMatchBundle()

  if (state.open && bundleState.selectedSlot === slot) {
    const result = await window.spellTimer.toggleOverlay()
    if (!result.ok) {
      setStatusRaw(result.error, 'error')
      return
    }
    overlayOpen = false
    renderMatchCards()
    setStatus('overlayState.closed', 'ok')
    return
  }

  const result = await window.spellTimer.selectMatch(slot)
  if (!result.ok) {
    setStatusRaw(result.error, 'error')
    return
  }

  overlayOpen = true
  selectedSlot = result.selectedSlot
  renderMatchCards()
  setStatus(slot === 'live' ? 'overlayState.openedLive' : 'overlayState.openedSelected', 'ok')
}

function regionLabel(platform: PlatformRegion): string {
  return tr(`region.${platform}` as MessageKey)
}

function refreshProfileSummary(): void {
  const selected = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId)
    : null
  const name = (selected?.gameName ?? currentUserConfig.gameName).trim()
  const tag = (selected?.tagLine ?? currentUserConfig.tagLine).trim()
  profileSummary.classList.remove('is-new')
  if (name && tag) {
    profileSummary.textContent = `${name}#${tag}`
  } else {
    profileSummary.textContent = tr('profile.select')
    profileSummary.classList.add('is-new')
  }
}

function hideProfileList(): void {
  profileListOpen = false
  profileHighlight = -1
  profileList.hidden = true
  profileList.innerHTML = ''
  profilePickerBtn.setAttribute('aria-expanded', 'false')
  void fitMainWindow()
}

function showProfileList(): void {
  const items = profiles
  if (!items.length) {
    hideProfileList()
    return
  }

  profileListOpen = true
  profileList.hidden = false
  profilePickerBtn.setAttribute('aria-expanded', 'true')
  profileList.innerHTML = items
    .map((profile, index) => {
      const active =
        index === profileHighlight || profile.id === selectedProfileId ? 'active' : ''
      return `
        <li class="profile-list-row">
          <button type="button" class="profile-pick ${active}" data-profile-id="${profile.id}">
            <span class="profile-list-name">${profile.gameName}#${profile.tagLine}</span>
            <span class="profile-list-meta">${regionLabel(profile.platform)} (${profile.platform})</span>
          </button>
          <button
            type="button"
            class="profile-list-delete"
            data-delete-id="${profile.id}"
            title="${tr('profile.deleteTitle')}"
            aria-label="${tr('profile.deleteAria', { label: `${profile.gameName}#${profile.tagLine}` })}"
          >X</button>
        </li>
      `
    })
    .join('')

  profileList.querySelectorAll<HTMLButtonElement>('button[data-profile-id]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      void pickProfile(button.dataset.profileId!)
    })
  })

  profileList.querySelectorAll<HTMLButtonElement>('button[data-delete-id]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      void removeProfile(button.dataset.deleteId!)
    })
  })

  void fitMainWindow()
}

function toggleProfileList(): void {
  if (profileListOpen) hideProfileList()
  else {
    profileHighlight = -1
    showProfileList()
  }
}

async function pickProfile(profileId: string): Promise<void> {
  const result = await window.spellTimer.selectProfile(profileId)
  if (!result.profile) {
    setStatus('profile.notFound', 'error')
    hideProfileList()
    return
  }
  profiles = result.state.profiles
  lastProfileId = result.state.lastProfileId
  selectedProfileId = result.profile.id
  applyUserConfig(result.userConfig)
  refreshProfileSummary()
  hideProfileList()
  bundle = { live: null, recent: [] }
  selectedSlot = null
  renderMatchCards()
  void fitMainWindow()
  await fetchMatchesOnly()
}

function openEditProfileWindow(): void {
  if (!selectedProfileId) {
    setStatus('profile.select', 'error')
    return
  }
  hideProfileList()
  window.spellTimer.openProfileEditor({ mode: 'edit', profileId: selectedProfileId })
}

function openNewProfileWindow(): void {
  hideProfileList()
  window.spellTimer.openProfileEditor({ mode: 'new' })
}

async function removeProfile(profileId: string): Promise<void> {
  const target = profiles.find((p) => p.id === profileId)
  if (!target) {
    setStatus('profile.notFound', 'error')
    return
  }

  const label = `${target.gameName}#${target.tagLine}`
  const ok = window.confirm(tr('profile.deleteConfirm', { label }))
  if (!ok) return

  newProfileBtn.disabled = true
  editProfileBtn.disabled = true
  try {
    const result = await window.spellTimer.deleteProfile(profileId)
    if (!result.ok) {
      setStatus('profile.cannotDelete', 'error')
      return
    }

    applyProfilesState(result.state)
    hideProfileList()

    if (result.profile) {
      selectedProfileId = result.profile.id
      applyUserConfig(result.userConfig)
      setStatus('profile.deletedSwitch', 'ok', {
        label,
        next: `${result.profile.gameName}#${result.profile.tagLine}`
      })
    } else {
      selectedProfileId = null
      applyUserConfig({ gameName: '', tagLine: '', platform: 'br1', apiKey: '' })
      setStatus('profile.deletedNone', 'ok', { label })
    }

    bundle = { live: null, recent: [] }
    selectedSlot = null
    renderMatchCards()
    void fitMainWindow()
  } finally {
    newProfileBtn.disabled = false
    editProfileBtn.disabled = false
  }
}

function applyProfilesState(state: ProfilesState): void {
  profiles = state.profiles
  lastProfileId = state.lastProfileId
  if (selectedProfileId && profiles.some((p) => p.id === selectedProfileId)) {
    // keep
  } else if (lastProfileId && profiles.some((p) => p.id === lastProfileId)) {
    selectedProfileId = lastProfileId
  } else {
    selectedProfileId = profiles[0]?.id ?? null
  }
  if (profileListOpen) showProfileList()
  refreshProfileSummary()
}

function applyUserConfig(config: UserConfig): void {
  currentUserConfig = {
    gameName: config.gameName,
    tagLine: config.tagLine,
    platform: REGIONS.some((region) => region.id === config.platform)
      ? config.platform
      : 'br1',
    apiKey: config.apiKey
  }
  refreshProfileSummary()
}

function applySettingsToUi(next: PanelSettings): void {
  settings = next
  shell.classList.toggle('locked', next.locked)
  document.documentElement.style.fontSize = `${next.fontSize}px`
  void fitMainWindow()
}

function applyStaticI18n(): void {
  document.documentElement.lang = bcp47(locale)
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined
    if (key) el.textContent = tr(key)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle as MessageKey | undefined
    if (key) el.title = tr(key)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria as MessageKey | undefined
    if (key) el.setAttribute('aria-label', tr(key))
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder as MessageKey | undefined
    if (key && 'placeholder' in el) {
      ;(el as HTMLInputElement).placeholder = tr(key)
    }
  })
  refreshProfileSummary()
  if (profileListOpen) showProfileList()
  renderMatchCards()
  paintStatus()
  void fitMainWindow()
}

async function fetchMatchesOnly(): Promise<void> {
  fetchMatchesBtn.disabled = true
  setStatus('match.fetching')
  try {
    const config = await window.spellTimer.getUserConfig()
    applyUserConfig(config)
    const result = await window.spellTimer.loadMatch({
      gameName: config.gameName,
      tagLine: config.tagLine,
      platform: config.platform,
      apiKey: config.apiKey,
      openOverlay: false
    })

    if (!result.ok) {
      setStatusRaw(result.error, 'error')
      return
    }

    applyBundleState({
      bundle: result.data,
      selectedSlot: result.selectedSlot
    })
    overlayOpen = (await window.spellTimer.getOverlayState()).open
    renderMatchCards()

    const recentN = result.data.recent?.length ?? 0
    if (result.data.live) {
      setStatus('match.fetchedLive', 'ok', { n: recentN })
    } else {
      setStatus('match.fetchedRecent', 'ok', { n: recentN })
    }
  } finally {
    fetchMatchesBtn.disabled = false
  }
}

async function syncFromProfilesChanged(state: ProfilesState): Promise<void> {
  applyProfilesState(state)
  applyUserConfig(await window.spellTimer.getUserConfig())
  void fitMainWindow()
}

async function init(): Promise<void> {
  locale = await window.spellTimer.getLocale()
  applyStaticI18n()

  const saved = await window.spellTimer.getUserConfig()
  applyUserConfig(saved)

  const profilesState = await window.spellTimer.getProfiles()
  selectedProfileId = profilesState.lastProfileId
  applyProfilesState(profilesState)

  settings = await window.spellTimer.getSettings('app')
  applySettingsToUi(settings)
  window.spellTimer.onSettingsChanged((payload) => {
    if (payload.scope === 'app') applySettingsToUi(payload.settings)
  })
  window.spellTimer.onLocaleChanged((next) => {
    locale = next
    applyStaticI18n()
  })

  applyBundleState(await window.spellTimer.getMatchBundle())
  window.spellTimer.onMatchBundle((state) => {
    applyBundleState(state)
  })
  window.spellTimer.onMatchBootError((message) => {
    bootLoading = false
    setStatusRaw(message, 'error')
  })

  window.spellTimer.onProfilesChanged((state) => {
    void syncFromProfilesChanged(state)
  })

  overlayOpen = (await window.spellTimer.getOverlayState()).open
  renderMatchCards()
  window.spellTimer.onOverlayState((state) => {
    const wasOpen = overlayOpen
    overlayOpen = state.open
    renderMatchCards()
    if (wasOpen && !state.open) {
      setStatus('overlayState.closedHint', 'ok')
    }
  })

  fetchMatchesBtn.addEventListener('click', () => void fetchMatchesOnly())
  editProfileBtn.addEventListener('click', () => openEditProfileWindow())
  newProfileBtn.addEventListener('click', () => openNewProfileWindow())
  profilePickerBtn.addEventListener('click', () => toggleProfileList())
  minBtn.addEventListener('click', () => window.spellTimer.minimize())
  closeBtn.addEventListener('click', () => window.spellTimer.close())
  configBtn.addEventListener('click', () => window.spellTimer.openSettings('app'))

  profilePickerBtn.addEventListener('keydown', (event) => {
    const items = profiles
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!profileListOpen) showProfileList()
      profileHighlight = Math.min(items.length - 1, profileHighlight + 1)
      showProfileList()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      profileHighlight = Math.max(0, profileHighlight - 1)
      showProfileList()
      return
    }
    if (event.key === 'Enter' && profileHighlight >= 0 && items[profileHighlight]) {
      event.preventDefault()
      void pickProfile(items[profileHighlight].id)
      return
    }
    if (event.key === 'Escape') {
      hideProfileList()
    }
  })

  document.addEventListener('mousedown', (event) => {
    const target = event.target as Node
    if (!profileListOpen) return
    if (profilePickerBtn.contains(target) || profileList.contains(target)) return
    hideProfileList()
  })

  refreshProfileSummary()

  if (saved.gameName && saved.apiKey.trim()) {
    bootLoading = !(bundle.live || bundle.recent.length)
    if (bootLoading) {
      setStatus('match.bootUpdating', '', { label: `${saved.gameName}#${saved.tagLine}` })
    } else {
      setStatus('profile.bootReady', 'ok', { label: `${saved.gameName}#${saved.tagLine}` })
    }
  } else if (saved.gameName) {
    setStatus('profile.exampleHint', '', { label: `${saved.gameName}#${saved.tagLine}` })
  } else {
    setStatus('profile.useNewOrSave')
  }
}

void init()
