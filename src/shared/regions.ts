import type { RegionOption } from './types'

export const REGIONS: RegionOption[] = [
  { id: 'br1', label: 'Brasil', routing: 'americas' },
  { id: 'na1', label: 'América do Norte', routing: 'americas' },
  { id: 'la1', label: 'América Latina Norte', routing: 'americas' },
  { id: 'la2', label: 'América Latina Sul', routing: 'americas' },
  { id: 'euw1', label: 'Europa Oeste', routing: 'europe' },
  { id: 'eun1', label: 'Europa Nórdica e Leste', routing: 'europe' },
  { id: 'tr1', label: 'Turquia', routing: 'europe' },
  { id: 'ru', label: 'Rússia', routing: 'europe' },
  { id: 'kr', label: 'Coreia', routing: 'asia' },
  { id: 'jp1', label: 'Japão', routing: 'asia' },
  { id: 'oc1', label: 'Oceania', routing: 'sea' },
  { id: 'ph2', label: 'Filipinas', routing: 'sea' },
  { id: 'sg2', label: 'Singapura', routing: 'sea' },
  { id: 'th2', label: 'Tailândia', routing: 'sea' },
  { id: 'tw2', label: 'Taiwan', routing: 'sea' },
  { id: 'vn2', label: 'Vietnã', routing: 'sea' }
]

export function getRegion(platform: string): RegionOption | undefined {
  return REGIONS.find((region) => region.id === platform)
}
