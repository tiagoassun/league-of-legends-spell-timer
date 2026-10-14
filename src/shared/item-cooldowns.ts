/**
 * Itens com cooldown (ativa / passiva) a partir do Data Dragon.
 * Usa texto EN e, quando existir, Effect*Amount (ex.: Zhonya Effect3=120).
 */

import { effectiveCooldownSeconds } from './abilities'
import type { CooldownTrackInfo } from './types'

interface DdragonItem {
  name: string
  description?: string
  image?: { full: string }
  effect?: Record<string, string>
  /** Alguns patches expoe cooldown numerico. */
  cooldown?: number | number[]
}

type ItemCdEntry = { name: string; baseCooldown: number; image: string }

const itemCdCache = new Map<string, Map<number, ItemCdEntry>>()

const CD_IN_DESC_RE =
  /(\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)\s*(?:cooldown|cd)\b/gi
const CD_LABEL_RE = /(?:cooldown|cd)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)?/gi

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

function parseCooldownSeconds(description: string): number {
  const desc = stripHtml(description)
  let best = 0
  for (const re of [CD_IN_DESC_RE, CD_LABEL_RE]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(desc)) !== null) {
      const n = Number(match[1])
      if (Number.isFinite(n) && n >= 1 && n <= 360) {
        best = Math.max(best, Math.round(n))
      }
    }
  }
  return best
}

/** Zhonya/GA etc.: CD costuma vir em Effect*Amount (inteiro 30-360). */
function cooldownFromEffects(item: DdragonItem): number {
  const desc = item.description || ''
  const trackable = /<active>/i.test(desc) || /<passive>/i.test(desc)
  if (!trackable || !item.effect) return 0

  const candidates: number[] = []
  for (const raw of Object.values(item.effect)) {
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    // Duracoes curtas (2.5s stasis) ficam de fora; CD tipico e inteiro >= 30.
    if (Number.isInteger(n) && n >= 30 && n <= 360) candidates.push(n)
  }
  if (!candidates.length) return 0
  return Math.max(...candidates)
}

export function itemIconUrl(version: string, imageFile: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${imageFile}`
}

export async function loadItemCooldownMap(version: string): Promise<Map<number, ItemCdEntry>> {
  const cached = itemCdCache.get(version)
  if (cached) return cached

  const map = new Map<number, ItemCdEntry>()
  try {
    const data = (await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`
    ).then((r) => r.json())) as { data: Record<string, DdragonItem> }

    for (const [id, item] of Object.entries(data.data)) {
      let base = 0
      if (typeof item.cooldown === 'number' && item.cooldown > 0) {
        base = Math.round(item.cooldown)
      } else if (Array.isArray(item.cooldown) && item.cooldown.length) {
        base = Math.round(Number(item.cooldown[0]) || 0)
      }
      if (base <= 0) base = parseCooldownSeconds(item.description || '')
      if (base <= 0) base = cooldownFromEffects(item)
      if (base <= 0 || !item.image?.full) continue
      map.set(Number(id), {
        name: item.name,
        baseCooldown: base,
        image: item.image.full
      })
    }
  } catch {
    // Sem tabela: lista de itens com CD fica vazia
  }

  itemCdCache.set(version, map)
  return map
}

/** Monta tracks de itens equipados que tenham CD (AH nao aplica em itens ativos). */
export async function buildEnemyCooldownItems(
  version: string,
  itemIds: number[]
): Promise<CooldownTrackInfo[]> {
  if (!itemIds.length) return []
  const map = await loadItemCooldownMap(version)
  const out: CooldownTrackInfo[] = []
  const seen = new Map<number, number>()

  for (const id of itemIds) {
    if (!id || id <= 0) continue
    const entry = map.get(id)
    if (!entry) continue
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    const key = n > 1 ? `${id}:${n}` : String(id)
    out.push({
      key,
      name: entry.name,
      baseCooldown: entry.baseCooldown,
      cooldown: entry.baseCooldown,
      iconFile: itemIconUrl(version, entry.image)
    })
  }

  return out
}

/** Recalcula CD de habilidade com AH; itens ficam com base. */
export function withAbilityHaste(track: CooldownTrackInfo, abilityHaste: number): CooldownTrackInfo {
  return {
    ...track,
    cooldown: effectiveCooldownSeconds(track.baseCooldown, abilityHaste)
  }
}
