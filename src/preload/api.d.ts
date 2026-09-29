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

export interface SpellTimerApi {
  loadMatch: (
    request: LoadMatchRequest
  ) => Promise<
    | {
        ok: true
        data: MatchBundle
        selectedSlot: MatchSlot | null
        currentMatch: ActiveMatchPayload | null
      }
    | { ok: false; error: string }
  >
  saveProfile: (
    request: SaveProfileRequest
  ) => Promise<
    | {
        ok: true
        profiles: ProfilesState
        profile: SavedProfile | null
        userConfig: UserConfig
      }
    | { ok: false; error: string }
  >
  getMatch: () => Promise<ActiveMatchPayload | null>
  getMatchBundle: () => Promise<MatchBundleState>
  selectMatch: (
    slot: MatchSlot
  ) => Promise<
    | { ok: true; currentMatch: ActiveMatchPayload; selectedSlot: MatchSlot }
    | { ok: false; error: string }
  >
  onMatchUpdated: (callback: (match: ActiveMatchPayload | null) => void) => () => void
  onMatchBundle: (callback: (state: MatchBundleState) => void) => () => void
  onMatchBootError: (callback: (message: string) => void) => () => void
  getUserConfig: () => Promise<UserConfig>
  saveUserConfig: (next: UserConfig) => Promise<UserConfig>
  getProfiles: () => Promise<ProfilesState>
  selectProfile: (
    profileId: string
  ) => Promise<{ state: ProfilesState; profile: SavedProfile | null; userConfig: UserConfig }>
  deleteProfile: (
    profileId: string
  ) => Promise<{
    ok: boolean
    state: ProfilesState
    profile: SavedProfile | null
    userConfig: UserConfig
  }>
  onProfilesChanged: (callback: (state: ProfilesState) => void) => () => void
  getSettings: (scope: SettingsScope) => Promise<PanelSettings>
  updateSettings: (scope: SettingsScope, patch: Partial<PanelSettings>) => Promise<PanelSettings>
  onSettingsChanged: (
    callback: (payload: { scope: SettingsScope; settings: PanelSettings }) => void
  ) => () => void
  onSettingsScope: (callback: (scope: SettingsScope) => void) => () => void
  getLocale: () => Promise<import('../shared/i18n').AppLocale>
  setLocale: (locale: import('../shared/i18n').AppLocale) => Promise<import('../shared/i18n').AppLocale>
  onLocaleChanged: (callback: (locale: import('../shared/i18n').AppLocale) => void) => () => void
  openSettings: (scope: SettingsScope) => void
  closeSettings: () => void
  openProfileEditor: (request: OpenProfileEditorRequest) => void
  fitOverlay: (size: { width: number; height: number }) => Promise<boolean>
  setOverlayIgnoreMouseEvents: (ignore: boolean) => void
  startOverlayDrag: (point: { screenX: number; screenY: number }) => void
  moveOverlayDrag: (point: { screenX: number; screenY: number }) => void
  endOverlayDrag: () => void
  fitWindow: (size: { width: number; height: number }) => Promise<boolean>
  getOverlayState: () => Promise<{ open: boolean; hasMatch: boolean }>
  toggleOverlay: () => Promise<
    { ok: true; open: boolean } | { ok: false; open: boolean; error: string }
  >
  onOverlayState: (callback: (state: { open: boolean; hasMatch: boolean }) => void) => () => void
  minimize: () => void
  close: () => void
}

declare global {
  interface Window {
    spellTimer: SpellTimerApi
  }
}

export {}
