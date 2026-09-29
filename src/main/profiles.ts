import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { PlatformRegion, ProfilesState, SavedProfile, UiSettings, UserConfig } from '../shared/types'
import { cloneUiSettings, normalizeUiSettings } from './ui-settings'

/** Perfis de exemplo embutidos (sempre presentes na lista, salvo se o usuario excluir). */
export const BUILTIN_PROFILES: Array<Omit<SavedProfile, 'lastUsedAt'>> = [
  {
    // Conta do Apdo/Dopa confirmada no cliente (KR): Apdo#Godd
    id: 'apdo#godd@kr',
    gameName: 'Apdo',
    tagLine: 'Godd',
    platform: 'kr',
    apiKey: ''
  }
]

/** Antigos exemplos removidos da lista embutida. */
const OBSOLETE_BUILTIN_IDS = new Set([
  't1 faker#kr1@kr',
  'blg knight#kr2@kr',
  'apdo#kr1@kr',
  'dopa0#kr1@kr',
  'daopa#chzzk@kr'
])

const BUILTIN_IDS = new Set(BUILTIN_PROFILES.map((p) => p.id))
const DEFAULT_PROFILE_ID = BUILTIN_PROFILES[0].id

/** @deprecated use BUILTIN_PROFILES[0] */
export const EXAMPLE_PROFILE = BUILTIN_PROFILES[0]

const EMPTY: ProfilesState = {
  profiles: [],
  lastProfileId: null,
  suppressedBuiltinIds: []
}

function profilesPath(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

export function profileId(gameName: string, tagLine: string, platform: string): string {
  return `${gameName.trim()}#${tagLine.trim()}@${platform}`.toLowerCase()
}

function normalizeProfile(raw: Partial<SavedProfile>): SavedProfile | null {
  if (
    typeof raw.gameName !== 'string' ||
    typeof raw.tagLine !== 'string' ||
    typeof raw.platform !== 'string' ||
    !raw.gameName.trim() ||
    !raw.tagLine.trim()
  ) {
    return null
  }

  const gameName = raw.gameName.trim()
  const tagLine = raw.tagLine.trim().replace(/^#/, '')
  const platform = raw.platform as PlatformRegion

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : profileId(gameName, tagLine, platform),
    gameName,
    tagLine,
    platform,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    lastUsedAt: typeof raw.lastUsedAt === 'number' ? raw.lastUsedAt : Date.now(),
    ui: raw.ui ? normalizeUiSettings(raw.ui) : undefined
  }
}

function writeProfiles(state: ProfilesState): ProfilesState {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const sorted = [...state.profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  const next: ProfilesState = {
    profiles: sorted,
    lastProfileId: state.lastProfileId,
    suppressedBuiltinIds: state.suppressedBuiltinIds ?? []
  }
  writeFileSync(profilesPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function pickFallbackLastId(profiles: SavedProfile[], preferred?: string | null): string | null {
  if (preferred && profiles.some((p) => p.id === preferred)) return preferred
  if (profiles.some((p) => p.id === DEFAULT_PROFILE_ID)) return DEFAULT_PROFILE_ID
  return profiles[0]?.id ?? null
}

/** Garante perfis embutidos na lista. Remove exemplos antigos. */
function ensureBuiltInProfiles(state: ProfilesState): ProfilesState {
  const suppressed = new Set(state.suppressedBuiltinIds ?? [])
  const hadDefault =
    state.profiles.some((p) => p.id === DEFAULT_PROFILE_ID) || suppressed.has(DEFAULT_PROFILE_ID)
  let profiles = state.profiles.filter((p) => !OBSOLETE_BUILTIN_IDS.has(p.id))
  let changed = profiles.length !== state.profiles.length

  for (const builtin of BUILTIN_PROFILES) {
    if (suppressed.has(builtin.id)) continue
    if (profiles.some((p) => p.id === builtin.id)) continue
    profiles.push({
      ...builtin,
      lastUsedAt: builtin.id === DEFAULT_PROFILE_ID ? 2 : 1
    })
    changed = true
  }

  let lastProfileId = state.lastProfileId
  if (lastProfileId && OBSOLETE_BUILTIN_IDS.has(lastProfileId)) {
    lastProfileId = pickFallbackLastId(profiles)
    changed = true
  }
  if (!lastProfileId || !profiles.some((p) => p.id === lastProfileId)) {
    lastProfileId = pickFallbackLastId(profiles)
    changed = true
  } else if (!hadDefault && profiles.some((p) => p.id === DEFAULT_PROFILE_ID)) {
    lastProfileId = DEFAULT_PROFILE_ID
    changed = true
  }

  const suppressedBuiltinIds = state.suppressedBuiltinIds ?? []
  if (!changed) {
    return { profiles, lastProfileId, suppressedBuiltinIds }
  }
  return writeProfiles({ profiles, lastProfileId, suppressedBuiltinIds })
}

export function loadProfiles(): ProfilesState {
  const path = profilesPath()
  if (!existsSync(path)) {
    return ensureBuiltInProfiles({ ...EMPTY, profiles: [] })
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProfilesState>
    const profiles = Array.isArray(raw.profiles)
      ? raw.profiles
          .map((item) => normalizeProfile(item as Partial<SavedProfile>))
          .filter((item): item is SavedProfile => item !== null)
      : []

    const suppressedBuiltinIds = Array.isArray(raw.suppressedBuiltinIds)
      ? raw.suppressedBuiltinIds.filter((id): id is string => typeof id === 'string')
      : []

    const lastProfileId =
      typeof raw.lastProfileId === 'string' && profiles.some((p) => p.id === raw.lastProfileId)
        ? raw.lastProfileId
        : profiles[0]?.id ?? null

    return ensureBuiltInProfiles({ profiles, lastProfileId, suppressedBuiltinIds })
  } catch {
    return ensureBuiltInProfiles({ ...EMPTY, profiles: [] })
  }
}

/** Cria perfil novo (ou sobrescreve se ja existir o mesmo nome#tag@regiao). */
export function createProfileFromConfig(
  config: UserConfig,
  ui?: UiSettings
): ProfilesState {
  const gameName = config.gameName.trim()
  const tagLine = config.tagLine.trim().replace(/^#/, '')
  if (!gameName || !tagLine) {
    return loadProfiles()
  }

  const state = loadProfiles()
  const id = profileId(gameName, tagLine, config.platform)
  const existing = state.profiles.find((p) => p.id === id)
  const profile: SavedProfile = {
    id,
    gameName,
    tagLine,
    platform: config.platform,
    apiKey: config.apiKey.trim() || existing?.apiKey || '',
    lastUsedAt: Date.now(),
    ui: existing?.ui
      ? cloneUiSettings(existing.ui)
      : cloneUiSettings(ui ?? normalizeUiSettings(undefined))
  }

  const suppressedBuiltinIds = (state.suppressedBuiltinIds ?? []).filter((sid) => sid !== id)
  const profiles = [profile, ...state.profiles.filter((p) => p.id !== id)]
  return writeProfiles({ profiles, lastProfileId: id, suppressedBuiltinIds })
}

/** Atualiza o perfil selecionado (mesmo se mudar nome/tag/regiao). */
export function updateProfileFromConfig(
  profileIdToUpdate: string,
  config: UserConfig,
  ui?: UiSettings
): ProfilesState {
  const gameName = config.gameName.trim()
  const tagLine = config.tagLine.trim().replace(/^#/, '')
  if (!gameName || !tagLine) {
    return loadProfiles()
  }

  const state = loadProfiles()
  const existing = state.profiles.find((p) => p.id === profileIdToUpdate)
  if (!existing) {
    return createProfileFromConfig(config, ui)
  }

  const nextId = profileId(gameName, tagLine, config.platform)
  const profile: SavedProfile = {
    id: nextId,
    gameName,
    tagLine,
    platform: config.platform,
    apiKey: config.apiKey.trim() || existing.apiKey || '',
    lastUsedAt: Date.now(),
    ui: ui
      ? cloneUiSettings(ui)
      : existing.ui
        ? cloneUiSettings(existing.ui)
        : cloneUiSettings()
  }

  const profiles = [
    profile,
    ...state.profiles.filter((p) => p.id !== profileIdToUpdate && p.id !== nextId)
  ]
  return writeProfiles({
    profiles,
    lastProfileId: nextId,
    suppressedBuiltinIds: state.suppressedBuiltinIds ?? []
  })
}

/** Grava opacidade/fonte/trava no perfil ativo. */
export function updateProfileUi(profileId: string, ui: UiSettings): ProfilesState {
  const state = loadProfiles()
  if (!state.profiles.some((p) => p.id === profileId)) {
    return state
  }

  const nextUi = cloneUiSettings(ui)
  const profiles = state.profiles.map((p) =>
    p.id === profileId ? { ...p, ui: nextUi } : p
  )
  return writeProfiles({
    profiles,
    lastProfileId: state.lastProfileId,
    suppressedBuiltinIds: state.suppressedBuiltinIds ?? []
  })
}

export function deleteProfile(id: string): {
  state: ProfilesState
  deleted: boolean
  nextProfile: SavedProfile | null
} {
  const state = loadProfiles()
  const existing = state.profiles.find((p) => p.id === id)
  if (!existing) {
    return { state, deleted: false, nextProfile: getLastProfile(state) }
  }

  const profiles = state.profiles.filter((p) => p.id !== id)
  const suppressedBuiltinIds = [...(state.suppressedBuiltinIds ?? [])]
  if (BUILTIN_IDS.has(id) && !suppressedBuiltinIds.includes(id)) {
    suppressedBuiltinIds.push(id)
  }

  const lastProfileId =
    state.lastProfileId === id ? pickFallbackLastId(profiles) : pickFallbackLastId(profiles, state.lastProfileId)

  const next = writeProfiles({ profiles, lastProfileId, suppressedBuiltinIds })
  const nextProfile =
    (lastProfileId ? next.profiles.find((p) => p.id === lastProfileId) : null) ??
    next.profiles[0] ??
    null

  return { state: next, deleted: true, nextProfile }
}

/** @deprecated use createProfileFromConfig / updateProfileFromConfig */
export function upsertProfileFromConfig(config: UserConfig): ProfilesState {
  return createProfileFromConfig(config)
}

export function selectProfile(id: string): { state: ProfilesState; profile: SavedProfile | null } {
  const state = loadProfiles()
  const profile = state.profiles.find((p) => p.id === id) ?? null
  if (!profile) {
    return { state, profile: null }
  }

  const next = writeProfiles({
    profiles: state.profiles.map((p) =>
      p.id === id ? { ...p, lastUsedAt: Date.now() } : p
    ),
    lastProfileId: id,
    suppressedBuiltinIds: state.suppressedBuiltinIds ?? []
  })
  return { state: next, profile: next.profiles.find((p) => p.id === id) ?? profile }
}

export function getLastProfile(state?: ProfilesState): SavedProfile | null {
  const current = state ?? loadProfiles()
  if (!current.profiles.length) return null
  if (current.lastProfileId) {
    return current.profiles.find((p) => p.id === current.lastProfileId) ?? current.profiles[0]
  }
  return current.profiles[0]
}

export function profileToUserConfig(profile: SavedProfile): UserConfig {
  return {
    gameName: profile.gameName,
    tagLine: profile.tagLine,
    platform: profile.platform,
    apiKey: profile.apiKey
  }
}

export function profileUiOrDefault(profile: SavedProfile | null | undefined): UiSettings {
  return profile?.ui ? cloneUiSettings(profile.ui) : cloneUiSettings()
}
