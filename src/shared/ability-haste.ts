/**
 * Ability Haste a partir de itens (Data Dragon) + bonus simples de runa.
 * Parseia a descricao EN ("N Ability Haste") porque o stats JSON costuma vir vazio.
 * O HTML do ddragon usa <attention>10</attention> Ability Haste - por isso stripHtml.
 */

const itemAhCache = new Map<string, Map<number, number>>()

const AH_IN_DESC_RE = /(\d+)\s*Ability Haste/gi

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

/** Transcendence: +10 AH a partir do nivel 10. */
export function transcendenceAbilityHaste(level: number, hasTranscendence: boolean): number {
  if (!hasTranscendence) return 0
  return level >= 10 ? 10 : 0
}

export async function loadItemAbilityHasteMap(version: string): Promise<Map<number, number>> {
  const cached = itemAhCache.get(version)
  if (cached) return cached

  const map = new Map<number, number>()
  try {
    const data = (await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`
    ).then((r) => r.json())) as {
      data: Record<string, { description?: string }>
    }

    for (const [id, item] of Object.entries(data.data)) {
      const desc = stripHtml(item.description || '')
      let total = 0
      AH_IN_DESC_RE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = AH_IN_DESC_RE.exec(desc)) !== null) {
        total += Number(match[1]) || 0
      }
      if (total > 0) map.set(Number(id), total)
    }
  } catch {
    // Sem tabela de itens: AH fica 0
  }

  itemAhCache.set(version, map)
  return map
}

export function abilityHasteFromItems(
  itemIds: number[],
  itemAh: Map<number, number>
): number {
  let total = 0
  for (const id of itemIds) {
    if (!id || id <= 0) continue
    total += itemAh.get(id) ?? 0
  }
  return total
}

export function totalAbilityHaste(options: {
  itemIds: number[]
  itemAh: Map<number, number>
  level: number
  hasTranscendence?: boolean
}): number {
  return (
    abilityHasteFromItems(options.itemIds, options.itemAh) +
    transcendenceAbilityHaste(options.level, Boolean(options.hasTranscendence))
  )
}
