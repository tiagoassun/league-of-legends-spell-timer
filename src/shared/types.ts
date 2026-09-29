export type PlatformRegion =
  | 'br1'
  | 'na1'
  | 'euw1'
  | 'eun1'
  | 'kr'
  | 'jp1'
  | 'la1'
  | 'la2'
  | 'oc1'
  | 'tr1'
  | 'ru'
  | 'ph2'
  | 'sg2'
  | 'th2'
  | 'tw2'
  | 'vn2'

export type RoutingRegion = 'americas' | 'europe' | 'asia' | 'sea'

export interface RegionOption {
  id: PlatformRegion
  label: string
  routing: RoutingRegion
}

export interface SummonerSpellInfo {
  id: number
  key: string
  name: string
  cooldown: number
  iconFile: string
}

export type AbilitySlot = 'Q' | 'W' | 'E' | 'R'

export interface AbilityInfo {
  slot: AbilitySlot
  key: string
  name: string
  /** Rank estimado (1-5 / 1-3 no R). */
  rank: number
  /** CD base no rank (sem haste), segundos. */
  baseCooldown: number
  /** CD efetivo apos Ability Haste, segundos. */
  cooldown: number
  iconFile: string
}

/** Passiva ou item com tempo de recarga rastreavel no overlay. */
export interface CooldownTrackInfo {
  key: string
  name: string
  baseCooldown: number
  cooldown: number
  iconFile: string
}

export interface EnemyPlayer {
  puuid: string
  riotId: string
  championId: number
  championName: string
  championIconUrl: string
  spell1: SummonerSpellInfo
  spell2: SummonerSpellInfo
  /** Nivel do campeao (Live Client / Match-V5). */
  level?: number
  /** Ability Haste estimado (itens + Transcendence). */
  abilityHaste?: number
  /** Skills Q/W/E/R com CD efetivo (quando houver dados de campeao). */
  abilities?: Record<AbilitySlot, AbilityInfo>
  /** Passiva do campeao, so se tiver CD. */
  passive?: CooldownTrackInfo | null
  /** Itens com passiva/ativa que tem CD. */
  cooldownItems?: CooldownTrackInfo[]
}

export interface ActiveMatchPayload {
  gameId: number
  gameMode: string
  /** Fila Riot (queueId / gameQueueConfigId). Null se desconhecido. */
  queueId: number | null
  /** Rotulo legivel da fila (ex.: Ranked Solo/Duo, ARAM). */
  queueLabel: string
  gameStartTime: number
  /** Fim da partida (ms). Null se ainda em andamento. */
  gameEndTime: number | null
  enemies: EnemyPlayer[]
  /** live = partida ativa; last = historico */
  source: 'live' | 'last'
}

/** Resultado da busca: ao vivo (se houver) + ate 3 partidas 5v5 recentes. */
export interface MatchBundle {
  live: ActiveMatchPayload | null
  recent: ActiveMatchPayload[]
}

/** live ou indice recente (r0, r1, r2...). */
export type MatchSlot = 'live' | `r${number}`

export interface LoadMatchRequest {
  gameName: string
  tagLine: string
  platform: PlatformRegion
  /** Chave Riot informada na UI (nao editar .env). */
  apiKey?: string
  /** Se true, abre o overlay apos carregar (padrao: false). */
  openOverlay?: boolean
}

/** Grava perfil sem buscar partidas. */
export interface SaveProfileRequest {
  gameName: string
  tagLine: string
  platform: PlatformRegion
  apiKey?: string
  /** Id do perfil a atualizar. Null + createProfile=true cria novo. */
  profileId?: string | null
  /** Se true, grava como perfil novo. */
  createProfile?: boolean
}

export type ProfileEditorMode = 'edit' | 'new'

/** Abre a janela de editar / novo perfil. */
export interface OpenProfileEditorRequest {
  mode: ProfileEditorMode
  profileId?: string | null
}

/** Conta + chave salvos pelo app (userData), sem o usuario editar arquivo. */
export interface UserConfig {
  gameName: string
  tagLine: string
  platform: PlatformRegion
  apiKey: string
}

/** Perfil gravado apos busca com sucesso. */
export interface SavedProfile {
  id: string
  gameName: string
  tagLine: string
  platform: PlatformRegion
  apiKey: string
  lastUsedAt: number
  /** Opacidade / fonte / trava desta conta (programa + overlay). */
  ui?: UiSettings
}

export interface ProfilesState {
  profiles: SavedProfile[]
  lastProfileId: string | null
  /** Ids de perfis embutidos que o usuario removeu (nao reinsere). */
  suppressedBuiltinIds?: string[]
}

export type SettingsScope = 'app' | 'overlay'

export interface PanelSettings {
  locked: boolean
  opacity: number
  /** Tamanho da fonte em px (estilo Word: 10, 11, 12, 14...). */
  fontSize: number
}

export interface UiSettings {
  /** Locale do app (padrao pt_BR). */
  locale: import('./i18n/locales').AppLocale
  app: PanelSettings
  overlay: PanelSettings
}

export type SpellSlot = 'spell1' | 'spell2' | AbilitySlot | 'P' | `item:${string}`

export interface SpellTimerState {
  enemyPuuid: string
  slot: SpellSlot
  endsAt: number
  cooldown: number
}
