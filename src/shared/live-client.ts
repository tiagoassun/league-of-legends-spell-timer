import https from 'node:https'
import { SUMMONER_SPELLS, getSummonerSpell } from './spells'
import type { SummonerSpellInfo } from './types'

const LIVE_HOST = '127.0.0.1'
const LIVE_PORT = 2999
const LIVE_PREFIX = '/liveclientdata'

export interface LiveClientSpell {
  displayName?: string
  rawDisplayName?: string
  rawDescription?: string
}

export interface LiveClientItem {
  itemID: number
  stackSize?: number
  displayName?: string
}

export interface LiveClientPlayer {
  championName: string
  isBot?: boolean
  level?: number
  riotId?: string
  riotIdGameName?: string
  riotIdTagLine?: string
  summonerName?: string
  team: 'ORDER' | 'CHAOS' | string
  items?: LiveClientItem[]
  /** Alguns clientes expoe ids de runas; Transcendence = 8210. */
  runes?: {
    keystone?: { id?: number }
    primaryRuneTree?: { id?: number }
    secondaryRuneTree?: { id?: number }
  }
  summonerSpells?: {
    summonerSpellOne?: LiveClientSpell
    summonerSpellTwo?: LiveClientSpell
  }
}

export interface LiveClientGameData {
  gameMode?: string
  gameTime?: number
  mapName?: string
  mapNumber?: number
  gameId?: number
}

function liveGet<T>(path: string): Promise<T | null> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: LIVE_HOST,
        port: LIVE_PORT,
        path: `${LIVE_PREFIX}${path}`,
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 1500
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            resolve(null)
            return
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T)
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
    req.end()
  })
}

/** true se o cliente local do LoL expoe a API da partida. */
export async function isLiveClientAvailable(): Promise<boolean> {
  const stats = await liveGet<LiveClientGameData>('/gamestats')
  return stats != null && typeof stats.gameTime === 'number'
}

export async function fetchLiveClientAllGameData(): Promise<{
  gameData?: LiveClientGameData
  allPlayers?: LiveClientPlayer[]
} | null> {
  return liveGet('/allgamedata')
}

export async function fetchLiveClientPlayers(): Promise<LiveClientPlayer[] | null> {
  const all = await fetchLiveClientAllGameData()
  if (Array.isArray(all?.allPlayers) && all.allPlayers.length > 0) {
    return all.allPlayers
  }
  const list = await liveGet<LiveClientPlayer[]>('/playerlist')
  return Array.isArray(list) && list.length > 0 ? list : null
}

export async function fetchLiveClientGameData(): Promise<LiveClientGameData | null> {
  const fromAll = await fetchLiveClientAllGameData()
  if (fromAll?.gameData) return fromAll.gameData
  return liveGet<LiveClientGameData>('/gamestats')
}

export function liveClientItemIds(player: LiveClientPlayer): number[] {
  if (!Array.isArray(player.items)) return []
  return player.items.map((it) => Number(it.itemID)).filter((id) => id > 0)
}

/** Id da runa Transcendence no jogo. */
export const RUNE_TRANSCENDENCE_ID = 8210

export function liveClientHasTranscendence(player: LiveClientPlayer): boolean {
  const raw = JSON.stringify(player.runes ?? {})
  return raw.includes(String(RUNE_TRANSCENDENCE_ID))
}

export async function fetchLiveClientActivePlayerName(): Promise<string | null> {
  const name = await liveGet<string>('/activeplayername')
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

/**
 * Resolve spell do Live Client (Flash, Teleporte Irrestrito, etc.) para o catalogo local.
 */
export function summonerSpellFromLiveClient(spell: LiveClientSpell | undefined): SummonerSpellInfo {
  if (!spell) return getSummonerSpell(4)

  const raw = spell.rawDisplayName || spell.rawDescription || ''
  const keyMatch =
    /SummonerSpell_(?:S\d+_)?(Summoner[A-Za-z0-9]+?)(?:Upgrade)?_(?:DisplayName|Description)/i.exec(
      raw
    ) || /SummonerSpell_(?:S\d+_)?([A-Za-z0-9]+)_(?:DisplayName|Description)/i.exec(raw)

  let key = keyMatch?.[1] ?? ''
  if (/smite/i.test(key) || /smite/i.test(raw)) key = 'SummonerSmite'
  else if (/teleport/i.test(key) || /teleport/i.test(raw)) key = 'SummonerTeleport'
  else if (key.endsWith('Upgrade')) key = key.replace(/Upgrade$/i, '')

  const byKey = Object.values(SUMMONER_SPELLS).find((s) => s.key === key)
  if (byKey) return byKey

  const display = (spell.displayName || '').toLowerCase()
  const byName = Object.values(SUMMONER_SPELLS).find(
    (s) => s.name.toLowerCase() === display || display.includes(s.name.toLowerCase())
  )
  if (byName) return byName

  return getSummonerSpell(4)
}

export function liveClientRiotId(player: LiveClientPlayer): string {
  const full = (player.riotId || '').trim()
  if (full && full !== '#' && full.includes('#')) return full
  const name = (player.riotIdGameName || '').trim()
  const tag = (player.riotIdTagLine || '').trim()
  if (name && tag) return `${name}#${tag}`
  return (player.summonerName || player.championName || 'Jogador').trim()
}

export function normalizeRiotId(value: string): string {
  return value.trim().replace(/^#/, '').toLowerCase()
}

export function teamIdFromLive(team: string): number {
  return team === 'ORDER' ? 100 : 200
}
