import { config } from 'dotenv'
import { existsSync } from 'fs'
import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'path'
import { loadMatchBundle, matchFromSlot, pickDefaultMatch, pickDefaultSlot, refreshLiveMatchPayload } from '../shared/riot'
import type {
  ActiveMatchPayload,
  LoadMatchRequest,
  MatchBundle,
  MatchSlot,
  OpenProfileEditorRequest,
  PanelSettings,
  ProfilesState,
  SaveProfileRequest,
  SavedProfile,
  SettingsScope,
  UiSettings,
  UserConfig
} from '../shared/types'
import {
  createProfileFromConfig,
  deleteProfile,
  getLastProfile,
  loadProfiles,
  profileToUserConfig,
  profileUiOrDefault,
  selectProfile,
  updateProfileFromConfig,
  updateProfileUi
} from './profiles'
import { cloneUiSettings, loadUiSettings, saveUiSettings } from './ui-settings'
import { loadUserConfig, saveUserConfig } from './user-config'
import { DEFAULT_LOCALE, isAppLocale, t, type AppLocale } from '../shared/i18n'

config()

type RendererPage = 'index.html' | 'settings.html' | 'overlay.html' | 'profile.html'

function appIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath, 'icon.ico'),
    join(__dirname, '../../build/icon.ico'),
    join(app.getAppPath(), 'build/icon.ico')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

function applyWindowIcon(win: BrowserWindow): void {
  const path = appIconPath()
  if (!path) return
  const image = nativeImage.createFromPath(path)
  if (image.isEmpty()) return
  win.setIcon(image)
}

let overlayDragOffset: { x: number; y: number } | null = null

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let appSettingsWindow: BrowserWindow | null = null
let overlaySettingsWindow: BrowserWindow | null = null
let profileEditorWindow: BrowserWindow | null = null

let uiSettings: UiSettings = loadUiSettingsSafe()
let userConfig: UserConfig = {
  gameName: '',
  tagLine: '',
  platform: 'br1',
  apiKey: ''
}
let currentMatch: ActiveMatchPayload | null = null
let matchBundle: MatchBundle = { live: null, recent: [] }
let selectedSlot: MatchSlot | null = null
let profilesState: ProfilesState = { profiles: [], lastProfileId: null }

function broadcastMatchBundle(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('match:bundle', {
      bundle: matchBundle,
      selectedSlot,
      currentMatch
    })
    win.webContents.send('match:updated', currentMatch)
  }
}

const LIVE_POLL_MS = 10_000
let livePollHandle: ReturnType<typeof setInterval> | null = null
let livePollRunning = false

function stopLivePoll(): void {
  if (livePollHandle !== null) {
    clearInterval(livePollHandle)
    livePollHandle = null
  }
}

function startLivePoll(): void {
  if (livePollHandle !== null) return
  livePollHandle = setInterval(() => {
    void pollLiveMatch()
  }, LIVE_POLL_MS)
}

async function pollLiveMatch(): Promise<void> {
  if (livePollRunning) return
  if (!matchBundle.live) {
    stopLivePoll()
    return
  }
  livePollRunning = true
  try {
    const next = await refreshLiveMatchPayload(
      userConfig.gameName,
      userConfig.tagLine,
      matchBundle.live
    )
    if (!next) {
      matchBundle = { live: null, recent: matchBundle.recent }
      if (selectedSlot === 'live') {
        selectedSlot = pickDefaultSlot(matchBundle)
        currentMatch = pickDefaultMatch(matchBundle)
      } else if (currentMatch?.source === 'live') {
        currentMatch = pickDefaultMatch(matchBundle)
      }
      broadcastMatchBundle()
      stopLivePoll()
      return
    }

    matchBundle = { live: next, recent: matchBundle.recent }
    if (selectedSlot === 'live' || currentMatch?.source === 'live') {
      currentMatch = next
    }
    broadcastMatchBundle()
  } catch {
    // Mantem o ultimo snapshot; tenta de novo no proximo tick
  } finally {
    livePollRunning = false
  }
}

function syncLivePoll(): void {
  if (matchBundle.live) startLivePoll()
  else stopLivePoll()
}

function broadcastProfiles(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('profiles:changed', profilesState)
  }
}

function loadUiSettingsSafe(): UiSettings {
  // app ainda nao ready no top-level; carrega de novo no whenReady.
  return {
    locale: 'pt_BR',
    app: { locked: false, opacity: 1, fontSize: 16 },
    overlay: { locked: false, opacity: 0.92, fontSize: 16 }
  }
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function rendererUrl(page: RendererPage): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    return page === 'index.html' ? `${base}/` : `${base}/${page}`
  }
  return join(__dirname, `../renderer/${page}`)
}

function loadRenderer(win: BrowserWindow, page: RendererPage, query?: Record<string, string>): void {
  const target = rendererUrl(page)
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(target)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
      }
    }
    console.log(`loading renderer: ${url.toString()}`)
    void win.loadURL(url.toString())
  } else if (query) {
    void win.loadFile(target, { query })
  } else {
    void win.loadFile(target)
  }
}

function broadcastPanel(scope: SettingsScope): void {
  const payload = uiSettings[scope]
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings:changed', { scope, settings: payload })
  }
}

function broadcastLocale(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('locale:changed', uiSettings.locale)
  }
}

function setAppLocale(next: AppLocale): AppLocale {
  uiSettings = saveUiSettings({ ...uiSettings, locale: next })
  persistUiToActiveProfile()
  broadcastLocale()
  return uiSettings.locale
}

function applyPanelToWindow(
  win: BrowserWindow | null,
  panel: PanelSettings,
  _scope: SettingsScope
): void {
  if (!win || win.isDestroyed()) return
  win.setOpacity(panel.opacity)
  // Tamanho so via fonte + fit (bordas nao redimensionam).
  win.setResizable(false)
  win.setMovable(!panel.locked)
}

function applyScope(scope: SettingsScope): void {
  if (scope === 'app') {
    applyPanelToWindow(mainWindow, uiSettings.app, 'app')
    if (profileEditorWindow && !profileEditorWindow.isDestroyed()) {
      profileEditorWindow.setOpacity(uiSettings.app.opacity)
    }
  } else {
    applyPanelToWindow(overlayWindow, uiSettings.overlay, 'overlay')
  }
  applySettingsWindowChrome(scope)
  broadcastPanel(scope)
}

function applyAllPanels(): void {
  applyPanelToWindow(mainWindow, uiSettings.app, 'app')
  applyPanelToWindow(overlayWindow, uiSettings.overlay, 'overlay')
  if (profileEditorWindow && !profileEditorWindow.isDestroyed()) {
    profileEditorWindow.setOpacity(uiSettings.app.opacity)
  }
  applySettingsWindowChrome('app')
  applySettingsWindowChrome('overlay')
  broadcastPanel('app')
  broadcastPanel('overlay')
}

function settingsWindowFor(scope: SettingsScope): BrowserWindow | null {
  return scope === 'overlay' ? overlaySettingsWindow : appSettingsWindow
}

function setSettingsWindowFor(scope: SettingsScope, win: BrowserWindow | null): void {
  if (scope === 'overlay') {
    overlaySettingsWindow = win
  } else {
    appSettingsWindow = win
  }
}

function isSettingsWindow(win: BrowserWindow | null): boolean {
  if (!win) return false
  return win === appSettingsWindow || win === overlaySettingsWindow
}

function closeAllSettingsWindows(): void {
  if (appSettingsWindow && !appSettingsWindow.isDestroyed()) appSettingsWindow.close()
  if (overlaySettingsWindow && !overlaySettingsWindow.isDestroyed()) overlaySettingsWindow.close()
}

/** Opacidade da janela de config segue o escopo correspondente. */
function applySettingsWindowChrome(scope: SettingsScope): void {
  const win = settingsWindowFor(scope)
  if (!win || win.isDestroyed()) return
  win.setOpacity(uiSettings[scope].opacity)
}

function applyProfileUi(profile: SavedProfile | null): void {
  uiSettings = saveUiSettings(profileUiOrDefault(profile))
  applyAllPanels()
}

function persistUiToActiveProfile(): void {
  const id = profilesState.lastProfileId
  if (!id) return
  profilesState = updateProfileUi(id, uiSettings)
  broadcastProfiles()
}

function overlaySizeForEnemies(count: number): { width: number; height: number } {
  const width = 200
  const chrome = 48
  const row = 86
  const height = Math.max(200, chrome + Math.max(count, 1) * row)
  return { width, height }
}

function createMainWindow(): void {
  const icon = appIconPath()
  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    minWidth: 280,
    minHeight: 280,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    hasShadow: true,
    backgroundColor: '#0c1016',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  applyWindowIcon(mainWindow)
  applyPanelToWindow(mainWindow, uiSettings.app, 'app')
  loadRenderer(mainWindow, 'index.html')

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastMatchBundle()
    broadcastProfiles()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()
    closeAllSettingsWindows()
  })

  mainWindow.on('minimize', () => hideSettingsForScope('app'))
  mainWindow.on('restore', () => showSettingsForScope('app'))
  mainWindow.on('show', () => showSettingsForScope('app'))
}

function isOverlayOpen(): boolean {
  return Boolean(overlayWindow && !overlayWindow.isDestroyed())
}

function broadcastOverlayState(): void {
  const state = {
    open: isOverlayOpen(),
    hasMatch: Boolean(currentMatch)
  }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('overlay:state', state)
  }
}

function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
}

function openOverlayWindow(): void {
  // Sempre abre destravado; o usuario trava de novo se quiser.
  if (uiSettings.overlay.locked) {
    uiSettings = saveUiSettings({
      ...uiSettings,
      overlay: { ...uiSettings.overlay, locked: false }
    })
    persistUiToActiveProfile()
    broadcastPanel('overlay')
  }

  const enemyCount = currentMatch?.enemies.length ?? 5
  const size = overlaySizeForEnemies(enemyCount)

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    // Nao forcar tamanho fixo: o renderer ajusta via fonte + fitOverlay.
    // showInactive: nao tira o foco do LoL.
    overlayWindow.showInactive()
    overlayWindow.moveTop()
    overlayWindow.webContents.send('match:updated', currentMatch)
    applyPanelToWindow(overlayWindow, uiSettings.overlay, 'overlay')
    broadcastOverlayState()
    return
  }

  const mainBounds = mainWindow?.getBounds()
  const x = mainBounds ? Math.round(mainBounds.x + mainBounds.width + 12) : undefined
  const y = mainBounds ? mainBounds.y : undefined
  const icon = appIconPath()

  overlayWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: 80,
    minHeight: 80,
    x,
    y,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    focusable: true,
    hasShadow: true,
    backgroundColor: '#0c1016',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Por padrao passa clique para o jogo; o renderer liga captura so nos botoes.
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  applyWindowIcon(overlayWindow)
  applyPanelToWindow(overlayWindow, uiSettings.overlay, 'overlay')
  loadRenderer(overlayWindow, 'overlay.html')
  overlayWindow.showInactive()

  overlayWindow.on('closed', () => {
    overlayWindow = null
    overlayDragOffset = null
    if (overlaySettingsWindow && !overlaySettingsWindow.isDestroyed()) {
      overlaySettingsWindow.close()
    }
    broadcastOverlayState()
  })

  overlayWindow.on('minimize', () => hideSettingsForScope('overlay'))
  overlayWindow.on('restore', () => showSettingsForScope('overlay'))
  overlayWindow.on('show', () => showSettingsForScope('overlay'))

  broadcastOverlayState()
}

function toggleSettingsWindow(scope: SettingsScope): void {
  const existing = settingsWindowFor(scope)
  if (existing && !existing.isDestroyed()) {
    existing.close()
    return
  }
  openSettingsWindow(scope)
}

function hideSettingsForScope(scope: SettingsScope): void {
  const win = settingsWindowFor(scope)
  if (!win || win.isDestroyed()) return
  win.hide()
}

function showSettingsForScope(scope: SettingsScope): void {
  const win = settingsWindowFor(scope)
  if (!win || win.isDestroyed()) return
  const owner = scope === 'overlay' ? overlayWindow : mainWindow
  if (!owner || owner.isDestroyed() || owner.isMinimized()) return
  win.showInactive()
}

function openSettingsWindow(scope: SettingsScope): void {
  const existing = settingsWindowFor(scope)
  if (existing && !existing.isDestroyed()) {
    existing.setOpacity(uiSettings[scope].opacity)
    existing.show()
    existing.focus()
    existing.moveTop()
    return
  }

  const anchor = scope === 'overlay' ? overlayWindow : mainWindow
  const bounds = anchor?.getBounds()
  const width = 300
  const height = 200
  const x = bounds ? Math.round(bounds.x + (bounds.width - width) / 2) : undefined
  const y = bounds ? Math.round(bounds.y + 48) : undefined
  const parent = anchor && !anchor.isDestroyed() ? anchor : undefined

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    parent,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#0c1016',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  setSettingsWindowFor(scope, win)

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setMenuBarVisibility(false)
  win.setOpacity(uiSettings[scope].opacity)
  loadRenderer(win, 'settings.html', { scope })

  win.webContents.on('did-finish-load', () => {
    const current = settingsWindowFor(scope)
    if (!current || current.isDestroyed() || current !== win) return
    current.webContents.send('settings:scope', scope)
  })

  win.on('closed', () => {
    if (settingsWindowFor(scope) === win) {
      setSettingsWindowFor(scope, null)
    }
  })
}

function openProfileEditorWindow(request: OpenProfileEditorRequest): void {
  const mode = request.mode === 'new' ? 'new' : 'edit'
  let profileId = (request.profileId ?? '').trim()
  if (mode === 'edit' && !profileId) {
    profileId = profilesState.lastProfileId ?? ''
  }

  const query: Record<string, string> = { mode }
  if (profileId) query.profileId = profileId

  if (profileEditorWindow && !profileEditorWindow.isDestroyed()) {
    profileEditorWindow.setOpacity(uiSettings.app.opacity)
    loadRenderer(profileEditorWindow, 'profile.html', query)
    profileEditorWindow.show()
    profileEditorWindow.focus()
    profileEditorWindow.moveTop()
    return
  }

  const bounds = mainWindow?.getBounds()
  const width = 360
  const height = 420
  const x = bounds ? Math.round(bounds.x + (bounds.width - width) / 2) : undefined
  const y = bounds ? Math.round(bounds.y + 48) : undefined
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    parent,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#0c1016',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  profileEditorWindow = win
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setMenuBarVisibility(false)
  win.setOpacity(uiSettings.app.opacity)
  loadRenderer(win, 'profile.html', query)

  win.on('closed', () => {
    if (profileEditorWindow === win) profileEditorWindow = null
  })
}

function isAuxWindow(win: BrowserWindow | null): boolean {
  if (!win) return false
  return isSettingsWindow(win) || win === profileEditorWindow
}

function windowFromEvent(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.tiago.lol-spell-timer')
  }

  userConfig = loadUserConfig()
  uiSettings = loadUiSettings()
  profilesState = loadProfiles()

  const lastProfile = getLastProfile(profilesState)
  if (lastProfile) {
    userConfig = saveUserConfig(profileToUserConfig(lastProfile))
    uiSettings = saveUiSettings(profileUiOrDefault(lastProfile))
  }

  createMainWindow()

  async function applyLoadedBundle(
    request: LoadMatchRequest,
    bundle: MatchBundle,
    apiKeyUsed: string | undefined
  ): Promise<{
    ok: true
    data: MatchBundle
    selectedSlot: MatchSlot | null
    currentMatch: ActiveMatchPayload | null
  }> {
    matchBundle = bundle
    selectedSlot = pickDefaultSlot(bundle)
    currentMatch = pickDefaultMatch(bundle)

    userConfig = saveUserConfig({
      gameName: request.gameName,
      tagLine: request.tagLine,
      platform: request.platform,
      apiKey: (request.apiKey ?? '').trim() || userConfig.apiKey || (apiKeyUsed ?? '')
    })

    broadcastMatchBundle()
    syncLivePoll()
    if (request.openOverlay && currentMatch) {
      openOverlayWindow()
    }
    return {
      ok: true as const,
      data: bundle,
      selectedSlot,
      currentMatch
    }
  }

  ipcMain.handle('profiles:save', (_event, request: SaveProfileRequest) => {
    try {
      const gameName = (request.gameName ?? '').trim()
      const tagLine = (request.tagLine ?? '').trim().replace(/^#/, '')
      if (!gameName || !tagLine) {
        return { ok: false as const, error: t(uiSettings.locale, 'profile.needNameTag') }
      }

      const nextConfig = {
        gameName,
        tagLine,
        platform: request.platform,
        apiKey: (request.apiKey ?? '').trim()
      }
      userConfig = saveUserConfig(nextConfig)

      if (request.createProfile || !request.profileId) {
        profilesState = createProfileFromConfig(userConfig, uiSettings)
      } else {
        profilesState = updateProfileFromConfig(request.profileId, userConfig, uiSettings)
      }
      broadcastProfiles()

      const saved = getLastProfile(profilesState)
      return {
        ok: true as const,
        profiles: profilesState,
        profile: saved,
        userConfig
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('match:load', async (_event, request: LoadMatchRequest) => {
    try {
      const apiKey = (request.apiKey ?? '').trim() || process.env.RIOT_API_KEY
      const bundle = await loadMatchBundle(request, apiKey)
      return await applyLoadedBundle(request, bundle, apiKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false as const, error: message }
    }
  })

  // Boot: atualiza partidas do ultimo perfil sem abrir overlay.
  void (async () => {
    const name = userConfig.gameName.trim()
    const tag = userConfig.tagLine.trim()
    const key = userConfig.apiKey.trim() || process.env.RIOT_API_KEY
    if (!name || !tag || !key) return
    try {
      const request: LoadMatchRequest = {
        gameName: name,
        tagLine: tag,
        platform: userConfig.platform,
        apiKey: userConfig.apiKey,
        openOverlay: false
      }
      const bundle = await loadMatchBundle(request, key)
      await applyLoadedBundle(request, bundle, key)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('match:boot-error', message)
      }
    }
  })()

  ipcMain.handle('match:get', () => currentMatch)

  ipcMain.handle('match:getBundle', () => ({
    bundle: matchBundle,
    selectedSlot,
    currentMatch
  }))

  ipcMain.handle('match:select', (_event, slot: MatchSlot) => {
    const next = matchFromSlot(matchBundle, slot)
    if (!next) {
      return { ok: false as const, error: t(uiSettings.locale, 'match.unavailable') }
    }
    selectedSlot = slot
    currentMatch = next
    broadcastMatchBundle()
    openOverlayWindow()
    return { ok: true as const, currentMatch: next, selectedSlot: slot }
  })

  ipcMain.handle('overlay:getState', () => ({
    open: isOverlayOpen(),
    hasMatch: Boolean(currentMatch)
  }))

  ipcMain.handle('overlay:toggle', () => {
    if (isOverlayOpen()) {
      closeOverlayWindow()
      return { ok: true as const, open: false as const }
    }
    if (!currentMatch) {
      currentMatch = pickDefaultMatch(matchBundle)
      selectedSlot = pickDefaultSlot(matchBundle)
    }
    if (!currentMatch) {
      return {
        ok: false as const,
        open: false as const,
        error: t(uiSettings.locale, 'overlayState.noMatch')
      }
    }
    openOverlayWindow()
    return { ok: true as const, open: true as const }
  })

  ipcMain.handle('userConfig:get', () => userConfig)

  ipcMain.handle('userConfig:save', (_event, next: UserConfig) => {
    userConfig = saveUserConfig(next)
    return userConfig
  })

  ipcMain.handle('profiles:get', () => profilesState)

  ipcMain.on('profiles:openEditor', (_event, request: OpenProfileEditorRequest) => {
    openProfileEditorWindow(request ?? { mode: 'edit' })
  })

  ipcMain.handle('profiles:select', (_event, profileId: string) => {
    const result = selectProfile(profileId)
    profilesState = result.state
    if (result.profile) {
      userConfig = saveUserConfig(profileToUserConfig(result.profile))
      applyProfileUi(result.profile)
    }
    broadcastProfiles()
    return { state: profilesState, profile: result.profile, userConfig }
  })

  ipcMain.handle('profiles:delete', (_event, profileId: string) => {
    const result = deleteProfile(profileId)
    profilesState = result.state
    if (result.nextProfile) {
      userConfig = saveUserConfig(profileToUserConfig(result.nextProfile))
      applyProfileUi(result.nextProfile)
    } else {
      userConfig = saveUserConfig({
        gameName: '',
        tagLine: '',
        platform: 'br1',
        apiKey: ''
      })
      uiSettings = saveUiSettings(cloneUiSettings())
      applyAllPanels()
    }
    broadcastProfiles()
    return {
      ok: result.deleted,
      state: profilesState,
      profile: result.nextProfile,
      userConfig
    }
  })

  ipcMain.handle('settings:get', (_event, scope: SettingsScope) => uiSettings[scope])

  ipcMain.handle('locale:get', () => uiSettings.locale ?? DEFAULT_LOCALE)

  ipcMain.handle('locale:set', (_event, next: string) => {
    const locale = isAppLocale(next) ? next : DEFAULT_LOCALE
    return setAppLocale(locale)
  })

  ipcMain.handle(
    'settings:update',
    (_event, scope: SettingsScope, patch: Partial<PanelSettings>) => {
      uiSettings = saveUiSettings({
        ...uiSettings,
        [scope]: { ...uiSettings[scope], ...patch }
      })
      persistUiToActiveProfile()
      applyScope(scope)
      return uiSettings[scope]
    }
  )

  ipcMain.on('settings:open', (_event, scope: SettingsScope) => {
    toggleSettingsWindow(scope === 'overlay' ? 'overlay' : 'app')
  })

  ipcMain.on('settings:close', (event) => {
    windowFromEvent(event)?.close()
  })

  ipcMain.handle('overlay:fit', (_event, size: { width: number; height: number }) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return false
    const width = Math.max(80, Math.round(size.width))
    const height = Math.max(80, Math.round(size.height))
    // Windows exige resizable temporario para setContentSize; min 1x1 libera encolher com a fonte.
    overlayWindow.setResizable(true)
    overlayWindow.setMinimumSize(1, 1)
    overlayWindow.setContentSize(width, height)
    overlayWindow.setMinimumSize(80, 80)
    overlayWindow.setResizable(false)
    overlayWindow.setMovable(!uiSettings.overlay.locked)
    return true
  })

  ipcMain.on('overlay:ignore-mouse', (event, ignore: boolean) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    if (event.sender !== overlayWindow.webContents) return
    // Durante drag manual, nunca reativa click-through.
    if (overlayDragOffset && ignore) return
    overlayWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true })
  })

  ipcMain.on('overlay:drag-start', (event, point: { screenX: number; screenY: number }) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    if (event.sender !== overlayWindow.webContents) return
    if (uiSettings.overlay.locked) return
    const bounds = overlayWindow.getBounds()
    overlayDragOffset = {
      x: point.screenX - bounds.x,
      y: point.screenY - bounds.y
    }
    overlayWindow.setIgnoreMouseEvents(false)
    overlayWindow.setMovable(true)
  })

  ipcMain.on('overlay:drag-move', (event, point: { screenX: number; screenY: number }) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    if (event.sender !== overlayWindow.webContents) return
    if (!overlayDragOffset) return
    overlayWindow.setPosition(
      Math.round(point.screenX - overlayDragOffset.x),
      Math.round(point.screenY - overlayDragOffset.y)
    )
  })

  ipcMain.on('overlay:drag-end', (event) => {
    if (event.sender !== overlayWindow?.webContents) return
    overlayDragOffset = null
  })

  ipcMain.handle('window:fit', (event, size: { width: number; height: number }) => {
    const win = windowFromEvent(event)
    if (!win || win.isDestroyed()) return false
    if (win === overlayWindow) {
      return false
    }

    const isAux = isAuxWindow(win)
    const minW = isAux ? 220 : 280
    const minH = isAux ? 140 : 280
    const width = Math.max(minW, Math.round(size.width))
    const height = Math.max(minH, Math.round(size.height))
    win.setResizable(true)
    win.setMinimumSize(minW, minH)
    win.setContentSize(width, height)
    win.setResizable(false)
    if (!isAux) {
      win.setMovable(!uiSettings.app.locked)
    }
    return true
  })

  ipcMain.on('window:minimize', (event) => {
    windowFromEvent(event)?.minimize()
  })

  ipcMain.on('window:close', (event) => {
    windowFromEvent(event)?.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
