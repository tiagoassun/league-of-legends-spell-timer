import { contextBridge, ipcRenderer } from 'electron'
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
  UserConfig
} from '../shared/types'

export type MatchBundleState = {
  bundle: MatchBundle
  selectedSlot: MatchSlot | null
  currentMatch: ActiveMatchPayload | null
}

contextBridge.exposeInMainWorld('spellTimer', {
  loadMatch: (request: LoadMatchRequest) => ipcRenderer.invoke('match:load', request),
  saveProfile: (request: SaveProfileRequest) => ipcRenderer.invoke('profiles:save', request),
  getMatch: (): Promise<ActiveMatchPayload | null> => ipcRenderer.invoke('match:get'),
  getMatchBundle: (): Promise<MatchBundleState> => ipcRenderer.invoke('match:getBundle'),
  selectMatch: (
    slot: MatchSlot
  ): Promise<
    | { ok: true; currentMatch: ActiveMatchPayload; selectedSlot: MatchSlot }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('match:select', slot),
  onMatchUpdated: (callback: (match: ActiveMatchPayload | null) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      match: ActiveMatchPayload | null
    ): void => {
      callback(match)
    }
    ipcRenderer.on('match:updated', listener)
    return () => ipcRenderer.removeListener('match:updated', listener)
  },
  onMatchBundle: (callback: (state: MatchBundleState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MatchBundleState): void => {
      callback(state)
    }
    ipcRenderer.on('match:bundle', listener)
    return () => ipcRenderer.removeListener('match:bundle', listener)
  },
  onMatchBootError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void => {
      callback(message)
    }
    ipcRenderer.on('match:boot-error', listener)
    return () => ipcRenderer.removeListener('match:boot-error', listener)
  },
  getUserConfig: (): Promise<UserConfig> => ipcRenderer.invoke('userConfig:get'),
  saveUserConfig: (next: UserConfig): Promise<UserConfig> =>
    ipcRenderer.invoke('userConfig:save', next),
  getProfiles: (): Promise<ProfilesState> => ipcRenderer.invoke('profiles:get'),
  selectProfile: (
    profileId: string
  ): Promise<{ state: ProfilesState; profile: SavedProfile | null; userConfig: UserConfig }> =>
    ipcRenderer.invoke('profiles:select', profileId),
  deleteProfile: (
    profileId: string
  ): Promise<{
    ok: boolean
    state: ProfilesState
    profile: SavedProfile | null
    userConfig: UserConfig
  }> => ipcRenderer.invoke('profiles:delete', profileId),
  onProfilesChanged: (callback: (state: ProfilesState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ProfilesState): void => {
      callback(state)
    }
    ipcRenderer.on('profiles:changed', listener)
    return () => ipcRenderer.removeListener('profiles:changed', listener)
  },
  getSettings: (scope: SettingsScope): Promise<PanelSettings> =>
    ipcRenderer.invoke('settings:get', scope),
  updateSettings: (scope: SettingsScope, patch: Partial<PanelSettings>): Promise<PanelSettings> =>
    ipcRenderer.invoke('settings:update', scope, patch),
  onSettingsChanged: (
    callback: (payload: { scope: SettingsScope; settings: PanelSettings }) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { scope: SettingsScope; settings: PanelSettings }
    ): void => {
      callback(payload)
    }
    ipcRenderer.on('settings:changed', listener)
    return () => ipcRenderer.removeListener('settings:changed', listener)
  },
  onSettingsScope: (callback: (scope: SettingsScope) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, scope: SettingsScope): void => {
      callback(scope)
    }
    ipcRenderer.on('settings:scope', listener)
    return () => ipcRenderer.removeListener('settings:scope', listener)
  },
  getLocale: (): Promise<import('../shared/i18n').AppLocale> => ipcRenderer.invoke('locale:get'),
  setLocale: (locale: import('../shared/i18n').AppLocale): Promise<import('../shared/i18n').AppLocale> =>
    ipcRenderer.invoke('locale:set', locale),
  onLocaleChanged: (callback: (locale: import('../shared/i18n').AppLocale) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      locale: import('../shared/i18n').AppLocale
    ): void => {
      callback(locale)
    }
    ipcRenderer.on('locale:changed', listener)
    return () => ipcRenderer.removeListener('locale:changed', listener)
  },
  openSettings: (scope: SettingsScope) => ipcRenderer.send('settings:open', scope),
  closeSettings: () => ipcRenderer.send('settings:close'),
  openProfileEditor: (request: OpenProfileEditorRequest) =>
    ipcRenderer.send('profiles:openEditor', request),
  fitOverlay: (size: { width: number; height: number }): Promise<boolean> =>
    ipcRenderer.invoke('overlay:fit', size),
  setOverlayIgnoreMouseEvents: (ignore: boolean): void => {
    ipcRenderer.send('overlay:ignore-mouse', ignore)
  },
  startOverlayDrag: (point: { screenX: number; screenY: number }): void => {
    ipcRenderer.send('overlay:drag-start', point)
  },
  moveOverlayDrag: (point: { screenX: number; screenY: number }): void => {
    ipcRenderer.send('overlay:drag-move', point)
  },
  endOverlayDrag: (): void => {
    ipcRenderer.send('overlay:drag-end')
  },
  fitWindow: (size: { width: number; height: number }): Promise<boolean> =>
    ipcRenderer.invoke('window:fit', size),
  getOverlayState: (): Promise<{ open: boolean; hasMatch: boolean }> =>
    ipcRenderer.invoke('overlay:getState'),
  toggleOverlay: (): Promise<
    { ok: true; open: boolean } | { ok: false; open: boolean; error: string }
  > => ipcRenderer.invoke('overlay:toggle'),
  onOverlayState: (callback: (state: { open: boolean; hasMatch: boolean }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { open: boolean; hasMatch: boolean }
    ): void => {
      callback(state)
    }
    ipcRenderer.on('overlay:state', listener)
    return () => ipcRenderer.removeListener('overlay:state', listener)
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close')
})
