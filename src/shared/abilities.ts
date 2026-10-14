import type { AbilityInfo, AbilitySlot, CooldownTrackInfo } from './types'

interface DdragonChampionSpell {
  id: string
  name: string
  cooldown: number[]
  image: { full: string }
}

interface DdragonChampionPassive {
  name: string
  description?: string
  image: { full: string }
}

interface DdragonChampionDetail {
  id: string
  key: string
  name: string
  spells: DdragonChampionSpell[]
  passive?: DdragonChampionPassive
}

export interface ChampionAbilityKit {
  championId: string
  championKey: number
  name: string
  spells: Record<AbilitySlot, { id: string; name: string; cooldowns: number[]; image: string }>
  passive?: { name: string; description: string; image: string }
}

const kitCache = new Map<string, ChampionAbilityKit>()

export function abilityIconUrl(version: string, imageFile: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imageFile}`
}

export function passiveIconUrl(version: string, imageFile: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${imageFile}`
}

const PASSIVE_CD_RE = [
  /(\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)\s*(?:cooldown|cd)\b/gi,
  /(?:cooldown|cd)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)?/gi,
  /(\d+(?:\.\d+)?)\s*(?:segundo|segundos)\s*(?:de\s*)?(?:recarga|cooldown)/gi,
  /(?:recarga|cooldown)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:segundo|segundos)?/gi
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

function parsePassiveCooldown(description: string): number {
  const desc = stripHtml(description)
  let best = 0
  for (const re of PASSIVE_CD_RE) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(desc)) !== null) {
      const n = Number(match[1])
      if (Number.isFinite(n) && n >= 1 && n <= 360) best = Math.max(best, Math.round(n))
    }
  }
  return best
}

type MerakiSlotCd = { baseCooldown: number; affectedByCdr: boolean; values: number[] }
type MerakiChampionCds = Partial<Record<AbilitySlot | 'P', MerakiSlotCd>>

const merakiChampionCdCache = new Map<string, MerakiChampionCds | null>()
const merakiChampionCdInflight = new Map<string, Promise<MerakiChampionCds | null>>()

/**
 * Data Dragon manda CD 0 em algumas skills (ex.: E do Rakan). Fallback estatico
 * alinhado ao Meraki, usado se a API falhar.
 */
const ZERO_CD_STATIC_FALLBACKS: Record<string, Partial<Record<AbilitySlot, number[]>>> = {
  Rakan: { E: [20, 18, 16, 14, 12] }
}

function merakiSlotFromRaw(
  raw:
    | {
        cooldown?: {
          affectedByCdr?: boolean
          modifiers?: Array<{ values?: number[] }>
        }
      }
    | undefined
): MerakiSlotCd | null {
  const mods = raw?.cooldown?.modifiers ?? []
  const values = (mods[0]?.values ?? [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Math.round(v))
  if (!values.length) return null
  return {
    baseCooldown: Math.max(...values),
    affectedByCdr: Boolean(raw?.cooldown?.affectedByCdr),
    values
  }
}

/** CDs Meraki por slot (Q/W/E/R/P). Cobre skills com CD 0 no Data Dragon (ex.: E do Rakan). */
async function loadMerakiChampionCooldowns(championId: string): Promise<MerakiChampionCds | null> {
  const id = championId.trim()
  if (!id) return null
  if (merakiChampionCdCache.has(id)) return merakiChampionCdCache.get(id) ?? null

  const inflight = merakiChampionCdInflight.get(id)
  if (inflight) return inflight

  const pending = (async (): Promise<MerakiChampionCds | null> => {
    try {
      const data = (await fetch(
        `https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${encodeURIComponent(id)}.json`
      ).then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })) as {
        abilities?: Partial<
          Record<
            AbilitySlot | 'P',
            Array<{
              cooldown?: {
                affectedByCdr?: boolean
                modifiers?: Array<{ values?: number[] }>
              }
            }>
          >
        >
      }

      const out: MerakiChampionCds = {}
      for (const slot of ['Q', 'W', 'E', 'R', 'P'] as const) {
        const entry = merakiSlotFromRaw(data.abilities?.[slot]?.[0])
        if (entry) out[slot] = entry
      }
      const final = Object.keys(out).length ? out : null
      merakiChampionCdCache.set(id, final)
      return final
    } catch {
      merakiChampionCdCache.set(id, null)
      return null
    } finally {
      merakiChampionCdInflight.delete(id)
    }
  })()

  merakiChampionCdInflight.set(id, pending)
  return pending
}

async function loadMerakiPassiveCooldown(championId: string): Promise<MerakiSlotCd | null> {
  const all = await loadMerakiChampionCooldowns(championId)
  return all?.P ?? null
}

function hasPositiveCooldown(cooldowns: number[]): boolean {
  return cooldowns.some((n) => Number.isFinite(n) && n > 0)
}

function resolveAbilityCooldowns(
  championId: string,
  slot: AbilitySlot,
  ddragonCooldowns: number[],
  meraki: MerakiChampionCds | null
): number[] {
  if (hasPositiveCooldown(ddragonCooldowns)) return ddragonCooldowns
  const fromMeraki = meraki?.[slot]?.values
  if (fromMeraki && hasPositiveCooldown(fromMeraki)) return fromMeraki
  const fromStatic = ZERO_CD_STATIC_FALLBACKS[championId]?.[slot]
  if (fromStatic && hasPositiveCooldown(fromStatic)) return fromStatic
  return ddragonCooldowns
}

function merakiCooldownAtLevel(values: number[], fallback: number, level: number): number {
  if (!values.length) return fallback
  if (values.length === 1) return values[0]
  const lv = Math.max(1, Math.min(18, Math.floor(level) || 1))
  if (values.length >= 18) return values[lv - 1] ?? fallback
  if (values.length >= 6) {
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor((lv - 1) / 3)))
    return values[idx] ?? fallback
  }
  return values[Math.min(values.length - 1, Math.max(0, lv - 1))] ?? fallback
}

/** Estima ranks Q/W/E/R a partir do nivel do campeao (Live Client nao expoe ranks inimigos). */
export function inferAbilityRanks(level: number): Record<AbilitySlot, number> {
  const lv = Math.max(1, Math.min(18, Math.floor(level) || 1))
  const r = lv >= 16 ? 3 : lv >= 11 ? 2 : lv >= 6 ? 1 : 0
  const basicPoints = Math.max(0, lv - r)
  const base = Math.floor(basicPoints / 3)
  const rem = basicPoints % 3
  const q = Math.min(5, base + (rem > 0 ? 1 : 0))
  const w = Math.min(5, base + (rem > 1 ? 1 : 0))
  const e = Math.min(5, base)
  return {
    Q: Math.max(basicPoints > 0 ? 1 : 0, q),
    W: Math.max(basicPoints > 1 ? 1 : 0, w),
    E: Math.max(basicPoints > 2 ? 1 : 0, e),
    R: r
  }
}

/** CD efetivo: base / (1 + AH/100), arredondado para cima em segundos. */
export function effectiveCooldownSeconds(baseSeconds: number, abilityHaste: number): number {
  if (!Number.isFinite(baseSeconds) || baseSeconds <= 0) return 0
  const ah = Math.max(0, abilityHaste || 0)
  return Math.max(1, Math.ceil(baseSeconds / (1 + ah / 100)))
}

function cooldownAtRank(cooldowns: number[], rank: number): number {
  if (!cooldowns.length) return 0
  if (rank <= 0) return cooldowns[0] ?? 0
  const idx = Math.min(cooldowns.length - 1, Math.max(0, rank - 1))
  return cooldowns[idx] ?? cooldowns[cooldowns.length - 1] ?? 0
}

export async function loadChampionAbilityKit(
  version: string,
  championId: string
): Promise<ChampionAbilityKit | null> {
  const id = championId.trim()
  if (!id) return null
  const cached = kitCache.get(`${version}:${id}`)
  if (cached) return cached

  try {
    const data = (await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion/${encodeURIComponent(id)}.json`
    ).then((r) => r.json())) as { data: Record<string, DdragonChampionDetail> }
    const detail = data.data[id]
    if (!detail?.spells || detail.spells.length < 4) return null

    const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R']
    const spells = {} as ChampionAbilityKit['spells']
    for (let i = 0; i < 4; i++) {
      const spell = detail.spells[i]
      const slot = slots[i]
      spells[slot] = {
        id: spell.id,
        name: spell.name,
        cooldowns: Array.isArray(spell.cooldown) ? spell.cooldown.map(Number) : [],
        image: spell.image.full
      }
    }

    const kit: ChampionAbilityKit = {
      championId: detail.id,
      championKey: Number(detail.key),
      name: detail.name,
      spells,
      passive: detail.passive
        ? {
            name: detail.passive.name,
            description: detail.passive.description || '',
            image: detail.passive.image.full
          }
        : undefined
    }
    kitCache.set(`${version}:${id}`, kit)
    return kit
  } catch {
    return null
  }
}

export async function buildEnemyAbilities(
  version: string,
  championId: string,
  level: number,
  abilityHaste: number
): Promise<Record<AbilitySlot, AbilityInfo> | null> {
  const kit = await loadChampionAbilityKit(version, championId)
  if (!kit) return null

  const ranks = inferAbilityRanks(level)
  const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R']
  const needsMeraki = slots.some((slot) => !hasPositiveCooldown(kit.spells[slot].cooldowns))
  const meraki = needsMeraki ? await loadMerakiChampionCooldowns(championId) : null
  const out = {} as Record<AbilitySlot, AbilityInfo>

  for (const slot of slots) {
    const spell = kit.spells[slot]
    const rank = ranks[slot]
    const cooldowns = resolveAbilityCooldowns(championId, slot, spell.cooldowns, meraki)
    const base = cooldownAtRank(cooldowns, rank > 0 ? rank : 1)
    const cooldown = effectiveCooldownSeconds(base, abilityHaste)
    out[slot] = {
      slot,
      key: spell.id,
      name: spell.name,
      rank: rank > 0 ? rank : 1,
      baseCooldown: base,
      cooldown,
      iconFile: abilityIconUrl(version, spell.image)
    }
  }

  return out
}

/**
 * Passiva com CD (Meraki / texto ddragon). Sem CD -> null.
 * AH so aplica se a fonte indicar affectedByCdr.
 */
export async function buildEnemyPassive(
  version: string,
  championId: string,
  abilityHaste: number,
  level = 18
): Promise<CooldownTrackInfo | null> {
  const kit = await loadChampionAbilityKit(version, championId)
  if (!kit?.passive) return null

  const meraki = await loadMerakiPassiveCooldown(championId)
  let base = 0
  let affectedByCdr = true
  if (meraki) {
    base = merakiCooldownAtLevel(meraki.values, meraki.baseCooldown, level)
    affectedByCdr = meraki.affectedByCdr
  }
  if (base <= 0) base = parsePassiveCooldown(kit.passive.description)
  if (base <= 0) return null

  const cooldown = affectedByCdr
    ? effectiveCooldownSeconds(base, abilityHaste)
    : Math.max(1, Math.round(base))

  return {
    key: 'P',
    name: kit.passive.name,
    baseCooldown: base,
    cooldown,
    iconFile: passiveIconUrl(version, kit.passive.image)
  }
}
