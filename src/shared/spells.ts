import type { SummonerSpellInfo } from './types'

/** Cooldowns base (segundos) - valores de referência do MVP; haste fica para fase seguinte. */
export const SUMMONER_SPELLS: Record<number, SummonerSpellInfo> = {
  1: { id: 1, key: 'SummonerBoost', name: 'Purificar', cooldown: 210, iconFile: 'SummonerBoost.png' },
  3: { id: 3, key: 'SummonerExhaust', name: 'Exaurir', cooldown: 210, iconFile: 'SummonerExhaust.png' },
  4: { id: 4, key: 'SummonerFlash', name: 'Flash', cooldown: 300, iconFile: 'SummonerFlash.png' },
  6: { id: 6, key: 'SummonerHaste', name: 'Fantasma', cooldown: 210, iconFile: 'SummonerHaste.png' },
  7: { id: 7, key: 'SummonerHeal', name: 'Curar', cooldown: 240, iconFile: 'SummonerHeal.png' },
  11: { id: 11, key: 'SummonerSmite', name: 'Golpear', cooldown: 90, iconFile: 'SummonerSmite.png' },
  12: { id: 12, key: 'SummonerTeleport', name: 'Teleportar', cooldown: 360, iconFile: 'SummonerTeleport.png' },
  13: { id: 13, key: 'SummonerMana', name: 'Clarão', cooldown: 240, iconFile: 'SummonerMana.png' },
  14: { id: 14, key: 'SummonerDot', name: 'Incendiar', cooldown: 180, iconFile: 'SummonerDot.png' },
  21: { id: 21, key: 'SummonerBarrier', name: 'Barreira', cooldown: 180, iconFile: 'SummonerBarrier.png' },
  32: { id: 32, key: 'SummonerSnowball', name: 'Bola de Neve', cooldown: 80, iconFile: 'SummonerSnowball.png' }
}

export function getSummonerSpell(id: number): SummonerSpellInfo {
  return (
    SUMMONER_SPELLS[id] ?? {
      id,
      key: `Unknown${id}`,
      name: `Spell ${id}`,
      cooldown: 300,
      iconFile: 'SummonerFlash.png'
    }
  )
}

export function spellIconUrl(ddragonVersion: string, iconFile: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${iconFile}`
}

export function championIconUrl(ddragonVersion: string, championKey: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championKey}.png`
}
