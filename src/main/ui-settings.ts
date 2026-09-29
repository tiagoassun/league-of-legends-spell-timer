import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '../shared/i18n'
import type { PanelSettings, UiSettings } from '../shared/types'

export const DEFAULT_PANEL: PanelSettings = {
  locked: false,
  opacity: 0.92,
  fontSize: 16
}

export const DEFAULT_UI: UiSettings = {
  locale: DEFAULT_LOCALE,
  app: { ...DEFAULT_PANEL, opacity: 1, locked: false },
  overlay: { ...DEFAULT_PANEL }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'ui-settings.json')
}

export function normalizePanel(
  raw: Partial<PanelSettings> | undefined,
  fallback: PanelSettings
): PanelSettings {
  return {
    locked: typeof raw?.locked === 'boolean' ? raw.locked : fallback.locked,
    opacity:
      typeof raw?.opacity === 'number' && raw.opacity >= 0.4 && raw.opacity <= 1
        ? raw.opacity
        : fallback.opacity,
    fontSize:
      typeof raw?.fontSize === 'number' && raw.fontSize >= 10 && raw.fontSize <= 32
        ? raw.fontSize
        : fallback.fontSize
  }
}

function normalizeLocale(raw: unknown): AppLocale {
  return typeof raw === 'string' && isAppLocale(raw) ? raw : DEFAULT_LOCALE
}

export function normalizeUiSettings(raw: Partial<UiSettings> | undefined): UiSettings {
  return {
    locale: normalizeLocale(raw?.locale),
    app: normalizePanel(raw?.app, DEFAULT_UI.app),
    overlay: normalizePanel(raw?.overlay, DEFAULT_UI.overlay)
  }
}

export function cloneUiSettings(ui: UiSettings = DEFAULT_UI): UiSettings {
  return {
    locale: ui.locale,
    app: { ...ui.app },
    overlay: { ...ui.overlay }
  }
}

export function loadUiSettings(): UiSettings {
  const path = settingsPath()
  if (!existsSync(path)) {
    return cloneUiSettings()
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<UiSettings>
    return normalizeUiSettings(raw)
  } catch {
    return cloneUiSettings()
  }
}

export function saveUiSettings(next: UiSettings): UiSettings {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const normalized = normalizeUiSettings(next)
  writeFileSync(settingsPath(), JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}
