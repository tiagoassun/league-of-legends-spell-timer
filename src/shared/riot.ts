import { buildEnemyAbilities, buildEnemyPassive } from './abilities'
import { loadItemAbilityHasteMap, totalAbilityHaste } from './ability-haste'
import { buildEnemyCooldownItems } from './item-cooldowns'
import {
  fetchLiveClientActivePlayerName,
  fetchLiveClientGameData,
  fetchLiveClientPlayers,
  liveClientHasTranscendence,
  liveClientItemIds,
  liveClientRiotId,
  normalizeRiotId,
  summonerSpellFromLiveClient,
  type LiveClientGameData,
  type LiveClientPlayer
} from './live-client'
import { getRegion } from './regions'
import { championIconUrl, getSummonerSpell, spellIconUrl } from './spells'
import type {
  ActiveMatchPayload,
  EnemyPlayer,
  LoadMatchRequest,
  MatchBundle,
  MatchSlot,
  PlatformRegion,
  SummonerSpellInfo
} from './types'

interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

interface MatchParticipantLike {
  puuid: string
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  riotId?: string
  level?: number
  itemIds?: number[]
  hasTranscendence?: boolean
}

interface SpectatorGame {
  gameId: number
  gameMode: string
  gameQueueConfigId?: number
  gameStartTime: number
  participants: Array<{
    puuid: string
    teamId: number
    championId: number
    spell1Id: number
    spell2Id: number
    riotId?: string
    summonerName?: string
  }>
}

interface MatchDto {
  metadata: { matchId: string }
  info: {
    gameId: number
    gameMode: string
    queueId: number
    gameStartTimestamp: number
    gameEndTimestamp?: number
    gameDuration?: number
    participants: Array<{
      puuid: string
      teamId: number
      championId: number
      summoner1Id: number
      summoner2Id: number
      riotIdGameName?: string
      riotIdTagline?: string
      summonerName?: string
      champLevel?: number
      item0?: number
      item1?: number
      item2?: number
      item3?: number
      item4?: number
      item5?: number
      item6?: number
      perks?: {
        styles?: Array<{
          selections?: Array<{ perk?: number }>
        }>
      }
    }>
  }
}

/** Filas 5v5 uteis pro spell timer (SR + ARAM). */
const SPELL_TIMER_QUEUES = new Set([
  400, // Normal Draft
  420, // Ranked Solo/Duo
  430, // Normal Blind
  440, // Ranked Flex
  450, // ARAM
  480, // Swiftplay
  490, // Quickplay
  700 // Clash
])

/** Rotulos pt-BR das filas que o overlay mostra. */
const QUEUE_LABELS: Record<number, string> = {
  400: '5x5 Normal (Draft)',
  420: '5x5 Ranked Solo/Duo',
  430: '5x5 Normal (Blind)',
  440: '5x5 Ranked Flex',
  450: 'ARAM',
  480: '5x5 Swiftplay',
  490: '5x5 Quickplay',
  700: '5x5 Clash'
}

export function queueLabel(queueId: number | null | undefined, gameMode?: string): string {
  if (typeof queueId === 'number' && QUEUE_LABELS[queueId]) {
    return QUEUE_LABELS[queueId]
  }
  if (gameMode === 'ARAM') return 'ARAM'
  if (gameMode === 'CLASSIC') return '5x5'
  if (gameMode) return gameMode
  return 'Partida'
}

function isSpellTimerMatch(match: MatchDto): boolean {
  const mode = match.info.gameMode
  // Arena e modos especiais fora do 5v5.
  if (mode === 'CHERRY' || mode === 'URF' || mode === 'ONEFORALL') {
    return false
  }
  if (match.info.participants.length !== 10) {
    return false
  }
  if (mode === 'CLASSIC' || mode === 'ARAM') {
    return true
  }
  return SPELL_TIMER_QUEUES.has(match.info.queueId)
}

interface ChampionEntry {
  key: string
  id: string
  name: string
}

let cachedDdragonVersion: string | null = null
let championByKey: Map<number, ChampionEntry> | null = null

async function riotGet<T>(url: string, apiKey: string, context: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey
    }
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 404) {
      throw new Error(context)
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key invalida ou sem permissao. Gere outra no portal Riot.')
    }
    if (response.status === 429) {
      throw new Error('Rate limit da Riot. Espere alguns segundos e tente de novo.')
    }
    throw new Error(`Riot API ${response.status}: ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

async function riotGetOrNull<T>(url: string, apiKey: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey
    }
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key invalida ou sem permissao. Gere outra no portal Riot.')
    }
    if (response.status === 429) {
      throw new Error('Rate limit da Riot. Espere alguns segundos e tente de novo.')
    }
    throw new Error(`Riot API ${response.status}: ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

async function getDdragonVersion(): Promise<string> {
  if (cachedDdragonVersion) return cachedDdragonVersion
  const versions = (await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) =>
    r.json()
  )) as string[]
  cachedDdragonVersion = versions[0]
  return cachedDdragonVersion
}

async function loadChampions(version: string): Promise<Map<number, ChampionEntry>> {
  if (championByKey) return championByKey
  const data = (await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion.json`
  ).then((r) => r.json())) as { data: Record<string, ChampionEntry> }

  championByKey = new Map()
  for (const champ of Object.values(data.data)) {
    championByKey.set(Number(champ.key), champ)
  }
  return championByKey
}

function withIcon(spell: SummonerSpellInfo, version: string): SummonerSpellInfo {
  return {
    ...spell,
    iconFile: spellIconUrl(version, spell.iconFile)
  }
}

function buildEnemyBase(
  participant: MatchParticipantLike,
  version: string,
  champions: Map<number, ChampionEntry>
): EnemyPlayer {
  const champ = champions.get(participant.championId)
  const spell1 = getSummonerSpell(participant.spell1Id)
  const spell2 = getSummonerSpell(participant.spell2Id)

  return {
    puuid: participant.puuid,
    riotId: participant.riotId || `Jogador ${participant.championId}`,
    championId: participant.championId,
    championName: champ?.name ?? `Campeão ${participant.championId}`,
    championIconUrl: championIconUrl(version, champ?.id ?? 'Aatrox'),
    spell1: withIcon(spell1, version),
    spell2: withIcon(spell2, version),
    level: participant.level
  }
}

async function attachAbilities(
  enemy: EnemyPlayer,
  version: string,
  champions: Map<number, ChampionEntry>,
  itemAh: Map<number, number>,
  itemIds: number[],
  hasTranscendence: boolean
): Promise<EnemyPlayer> {
  const champ = champions.get(enemy.championId)
  const champId = champ?.id
  if (!champId) {
    const cooldownItems = await buildEnemyCooldownItems(version, itemIds)
    return cooldownItems.length ? { ...enemy, cooldownItems } : enemy
  }

  const level = enemy.level && enemy.level > 0 ? enemy.level : 18
  const ah = totalAbilityHaste({
    itemIds,
    itemAh,
    level,
    hasTranscendence
  })
  const [abilities, passive, cooldownItems] = await Promise.all([
    buildEnemyAbilities(version, champId, level, ah),
    buildEnemyPassive(version, champId, ah, level),
    buildEnemyCooldownItems(version, itemIds)
  ])

  return {
    ...enemy,
    level,
    abilityHaste: ah,
    abilities: abilities ?? enemy.abilities,
    passive: passive,
    cooldownItems: cooldownItems.length ? cooldownItems : undefined
  }
}

async function enemiesFromParticipants(
  participants: MatchParticipantLike[],
  myPuuid: string,
  version: string,
  champions: Map<number, ChampionEntry>
): Promise<EnemyPlayer[]> {
  const me = participants.find((p) => p.puuid === myPuuid)
  if (!me) {
    throw new Error('Conta não encontrada entre os participantes da partida.')
  }

  const myTeam = Number(me.teamId)
  const itemAh = await loadItemAbilityHasteMap(version)
  const foes = participants.filter((p) => p.puuid !== myPuuid && Number(p.teamId) !== myTeam)

  return Promise.all(
    foes.map(async (p) => {
      const base = buildEnemyBase(p, version, champions)
      return attachAbilities(
        base,
        version,
        champions,
        itemAh,
        p.itemIds ?? [],
        Boolean(p.hasTranscendence)
      )
    })
  )
}

async function matchDtoToPayload(
  match: MatchDto,
  myPuuid: string,
  version: string,
  champions: Map<number, ChampionEntry>
): Promise<ActiveMatchPayload> {
  const participants: MatchParticipantLike[] = match.info.participants.map((p) => {
    const name = p.riotIdGameName?.trim()
    const tag = p.riotIdTagline?.trim()
    const riotId =
      name && tag ? `${name}#${tag}` : p.summonerName || `Jogador ${p.championId}`
    const itemIds = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
      .map((id) => Number(id) || 0)
      .filter((id) => id > 0)
    const perkIds =
      p.perks?.styles?.flatMap((style) =>
        (style.selections ?? []).map((sel) => Number(sel.perk) || 0)
      ) ?? []
    const hasTranscendence = perkIds.includes(8210)

    return {
      puuid: p.puuid,
      teamId: Number(p.teamId),
      championId: p.championId,
      spell1Id: p.summoner1Id,
      spell2Id: p.summoner2Id,
      riotId,
      level: typeof p.champLevel === 'number' ? p.champLevel : undefined,
      itemIds,
      hasTranscendence
    }
  })

  const enemies = await enemiesFromParticipants(participants, myPuuid, version, champions)
  const start = match.info.gameStartTimestamp
  const end =
    typeof match.info.gameEndTimestamp === 'number' && match.info.gameEndTimestamp > 0
      ? match.info.gameEndTimestamp
      : typeof match.info.gameDuration === 'number' && match.info.gameDuration > 0
        ? start + match.info.gameDuration * 1000
        : null

  const qid = match.info.queueId
  return {
    gameId: match.info.gameId,
    gameMode: match.info.gameMode,
    queueId: qid,
    queueLabel: queueLabel(qid, match.info.gameMode),
    gameStartTime: start,
    gameEndTime: end,
    source: 'last',
    enemies
  }
}

const RECENT_MATCH_LIMIT = 3
const MATCH_IDS_SCAN = 25

async function loadRecentMatches(
  routing: string,
  puuid: string,
  apiKey: string,
  version: string,
  limit = RECENT_MATCH_LIMIT
): Promise<ActiveMatchPayload[]> {
  const idsUrl =
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids` +
    `?start=0&count=${MATCH_IDS_SCAN}`

  const matchIds = await riotGet<string[]>(
    idsUrl,
    apiKey,
    'Conta ok, mas sem histórico de partidas recente.'
  )

  if (!matchIds.length) {
    return []
  }

  const champions = await loadChampions(version)
  const recent: ActiveMatchPayload[] = []

  for (const matchId of matchIds) {
    if (recent.length >= limit) break

    const matchUrl = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    const match = await riotGet<MatchDto>(
      matchUrl,
      apiKey,
      'Não foi possível carregar os detalhes da partida.'
    )

    if (!isSpellTimerMatch(match)) continue
    recent.push(await matchDtoToPayload(match, puuid, version, champions))
  }

  return recent
}

async function liveFromSpectator(
  live: SpectatorGame,
  myPuuid: string,
  version: string,
  champions: Map<number, ChampionEntry>
): Promise<ActiveMatchPayload | null> {
  const isFiveVFive = live.participants.length === 10 && live.gameMode !== 'CHERRY'
  if (!isFiveVFive) return null

  const participants: MatchParticipantLike[] = live.participants.map((p) => ({
    puuid: p.puuid,
    teamId: Number(p.teamId),
    championId: p.championId,
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    riotId: p.riotId || p.summonerName
  }))

  const qid =
    typeof live.gameQueueConfigId === 'number' ? live.gameQueueConfigId : null

  return {
    gameId: live.gameId,
    gameMode: live.gameMode,
    queueId: qid,
    queueLabel: queueLabel(qid, live.gameMode),
    gameStartTime: live.gameStartTime,
    gameEndTime: null,
    source: 'live',
    enemies: await enemiesFromParticipants(participants, myPuuid, version, champions)
  }
}

function findChampionByName(
  champions: Map<number, ChampionEntry>,
  championName: string
): ChampionEntry | undefined {
  const needle = championName.trim().toLowerCase()
  const compact = needle.replace(/[\s'.]/g, '')
  for (const champ of Array.from(champions.values())) {
    const id = champ.id.toLowerCase()
    const name = champ.name.toLowerCase()
    if (id === needle || name === needle) return champ
    if (id.replace(/[\s'.]/g, '') === compact || name.replace(/[\s'.]/g, '') === compact) {
      return champ
    }
  }
  return undefined
}

function findLiveMe(
  players: LiveClientPlayer[],
  myRiotId: string,
  activePlayerName: string | null
): LiveClientPlayer | undefined {
  const myNorm = normalizeRiotId(myRiotId)
  const byProfile = players.find((p) => normalizeRiotId(liveClientRiotId(p)) === myNorm)
  if (byProfile) return byProfile

  if (!activePlayerName?.trim()) return undefined
  const activeNorm = normalizeRiotId(activePlayerName)
  return players.find((p) => {
    const id = liveClientRiotId(p)
    return (
      normalizeRiotId(id) === activeNorm ||
      id === activePlayerName ||
      (p.summonerName || '') === activePlayerName
    )
  })
}

/**
 * Monta partida ao vivo a partir do Live Client local (127.0.0.1:2999).
 * Cobre Spectator 404, custom e treino com bots.
 */
async function liveFromLiveClient(
  players: LiveClientPlayer[],
  game: LiveClientGameData,
  myRiotId: string,
  activePlayerName: string | null,
  version: string,
  champions: Map<number, ChampionEntry>
): Promise<ActiveMatchPayload | null> {
  if (players.length < 2) return null
  if (game.gameMode === 'CHERRY' || game.gameMode === 'URF' || game.gameMode === 'ONEFORALL') {
    return null
  }

  const me = findLiveMe(players, myRiotId, activePlayerName)
  if (!me) return null

  const myTeam = me.team
  const itemAh = await loadItemAbilityHasteMap(version)
  const foes = players.filter((p) => p.team !== myTeam)

  const enemies: EnemyPlayer[] = await Promise.all(
    foes.map(async (p) => {
      const champ = findChampionByName(champions, p.championName)
      const riotId = liveClientRiotId(p)
      const stable = normalizeRiotId(riotId) || p.championName.toLowerCase()
      const level = typeof p.level === 'number' && p.level > 0 ? p.level : 1
      const base: EnemyPlayer = {
        puuid: `live-${stable}`,
        riotId,
        championId: champ ? Number(champ.key) : 0,
        championName: champ?.name ?? p.championName,
        championIconUrl: championIconUrl(
          version,
          champ?.id ?? p.championName.replace(/\s+/g, '')
        ),
        spell1: withIcon(
          summonerSpellFromLiveClient(p.summonerSpells?.summonerSpellOne),
          version
        ),
        spell2: withIcon(
          summonerSpellFromLiveClient(p.summonerSpells?.summonerSpellTwo),
          version
        ),
        level
      }
      return attachAbilities(
        base,
        version,
        champions,
        itemAh,
        liveClientItemIds(p),
        liveClientHasTranscendence(p)
      )
    })
  )

  if (!enemies.length) return null

  const gameTimeSec = typeof game.gameTime === 'number' ? game.gameTime : 0
  const gameStartTime = Date.now() - Math.max(0, gameTimeSec) * 1000

  return {
    gameId: typeof game.gameId === 'number' && game.gameId > 0 ? game.gameId : Date.now(),
    gameMode: game.gameMode || 'CLASSIC',
    queueId: null,
    queueLabel: queueLabel(null, game.gameMode),
    gameStartTime,
    gameEndTime: null,
    source: 'live',
    enemies
  }
}

async function tryLiveFromLocalClient(
  myRiotId: string,
  version: string,
  champions: Map<number, ChampionEntry>
): Promise<ActiveMatchPayload | null> {
  const players = await fetchLiveClientPlayers()
  if (!players) return null
  const game = (await fetchLiveClientGameData()) ?? {}
  const activeName = await fetchLiveClientActivePlayerName()
  return liveFromLiveClient(players, game, myRiotId, activeName, version, champions)
}

/** Atualiza so a partida ao vivo via Live Client (itens, nivel, AH). Sem Riot API. */
export async function refreshLiveMatchPayload(
  gameName: string,
  tagLine: string,
  previous: ActiveMatchPayload | null
): Promise<ActiveMatchPayload | null> {
  const version = await getDdragonVersion()
  const champions = await loadChampions(version)
  const myRiotId = `${gameName.trim()}#${tagLine.trim().replace(/^#/, '')}`
  const next = await tryLiveFromLocalClient(myRiotId, version, champions)
  if (!next) return null
  if (previous?.source === 'live') {
    return {
      ...next,
      gameId: previous.gameId,
      gameStartTime: previous.gameStartTime
    }
  }
  return next
}

export async function loadMatchBundle(
  request: LoadMatchRequest,
  apiKey: string | undefined
): Promise<MatchBundle> {
  const version = await getDdragonVersion()

  if (!apiKey?.trim()) {
    throw new Error('Informe a Riot API Key para buscar partidas.')
  }

  const region = getRegion(request.platform)
  if (!region) {
    throw new Error(`Região inválida: ${request.platform}`)
  }

  const gameName = request.gameName.trim()
  const tagLine = request.tagLine.trim().replace(/^#/, '')
  if (!gameName || !tagLine) {
    throw new Error('Informe nome de jogo e tag.')
  }

  const accountUrl =
    `https://${region.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`

  const account = await riotGet<RiotAccount>(
    accountUrl,
    apiKey,
    `Conta não encontrada: ${gameName}#${tagLine}. Confira nome, tag e se a conta é dessa região.`
  )

  const champions = await loadChampions(version)
  const myRiotId = `${account.gameName}#${account.tagLine}`

  // 1) Live Client local (mesmo com Spectator 404)
  let live = await tryLiveFromLocalClient(myRiotId, version, champions)

  // 2) Spectator API (fallback)
  if (!live) {
    const spectatorUrl =
      `https://${region.id}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/` +
      `${account.puuid}`
    const spectator = await riotGetOrNull<SpectatorGame>(spectatorUrl, apiKey)
    if (spectator) {
      live = await liveFromSpectator(spectator, account.puuid, version, champions)
    }
  }

  const recent = await loadRecentMatches(region.routing, account.puuid, apiKey, version)

  if (!live && !recent.length) {
    throw new Error(
      'Conta e API ok, mas sem partida ao vivo 5v5 e sem histórico 5v5 recente (Arena não conta).'
    )
  }

  return { live, recent }
}

export function recentSlot(index: number): MatchSlot {
  return `r${index}` as MatchSlot
}

export function matchFromSlot(
  bundle: MatchBundle,
  slot: MatchSlot | null
): ActiveMatchPayload | null {
  if (!slot) return null
  if (slot === 'live') return bundle.live
  const match = /^r(\d+)$/.exec(slot)
  if (!match) return null
  const index = Number(match[1])
  return bundle.recent[index] ?? null
}

/** Preferencia para o overlay: ao vivo, senao a mais recente. */
export function pickDefaultMatch(bundle: MatchBundle): ActiveMatchPayload | null {
  return bundle.live ?? bundle.recent[0] ?? null
}

export function pickDefaultSlot(bundle: MatchBundle): MatchSlot | null {
  if (bundle.live) return 'live'
  if (bundle.recent.length) return recentSlot(0)
  return null
}

export function defaultPlatform(): PlatformRegion {
  return 'br1'
}
