import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { UserConfig } from '../shared/types'

const DEFAULT_USER_CONFIG: UserConfig = {
  gameName: '',
  tagLine: '',
  platform: 'br1',
  apiKey: ''
}

function configPath(): string {
  return join(app.getPath('userData'), 'user-config.json')
}

export function loadUserConfig(): UserConfig {
  const path = configPath()
  if (!existsSync(path)) {
    return { ...DEFAULT_USER_CONFIG }
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<UserConfig>
    return {
      gameName: typeof raw.gameName === 'string' ? raw.gameName : '',
      tagLine: typeof raw.tagLine === 'string' ? raw.tagLine : '',
      platform: typeof raw.platform === 'string' ? raw.platform : 'br1',
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : ''
    }
  } catch {
    return { ...DEFAULT_USER_CONFIG }
  }
}

export function saveUserConfig(next: UserConfig): UserConfig {
  const path = configPath()
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const normalized: UserConfig = {
    gameName: next.gameName.trim(),
    tagLine: next.tagLine.trim(),
    platform: next.platform,
    apiKey: next.apiKey.trim()
  }

  writeFileSync(path, JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}
