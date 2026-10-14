import type { MessageKey } from './keys'
import {
  type AppLocale,
  DEFAULT_LOCALE,
  isAppLocale,
  bcp47 as toBcp47
} from './locales'
import type { MessageTable } from './messages'
import { MESSAGES } from './messages'

export * from './keys'
export * from './locales'
export type { MessageTable } from './messages'

export function t(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const table: MessageTable = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE]
  const fallback: MessageTable = MESSAGES.en_US ?? MESSAGES[DEFAULT_LOCALE]
  let text = table[key] ?? fallback[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

export function resolveLocale(value: string | undefined | null): AppLocale {
  if (value && isAppLocale(value)) return value
  return DEFAULT_LOCALE
}

export { toBcp47 as bcp47 }
