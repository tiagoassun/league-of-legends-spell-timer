export const APP_LOCALES = [
  'ar_AE',
  'cs_CZ',
  'de_DE',
  'el_GR',
  'en_AU',
  'en_GB',
  'en_PH',
  'en_SG',
  'en_US',
  'es_AR',
  'es_ES',
  'es_MX',
  'fr_FR',
  'hu_HU',
  'id_ID',
  'it_IT',
  'ja_JP',
  'ko_KR',
  'pl_PL',
  'pt_BR',
  'ro_RO',
  'ru_RU',
  'th_TH',
  'tr_TR',
  'vi_VN',
  'zh_CN',
  'zh_MY',
  'zh_TW'
] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'pt_BR'

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value)
}

/** Nome do idioma no proprio idioma. */
export const LOCALE_DISPLAY_NAMES: Record<AppLocale, string> = {
  ar_AE: 'العربية',
  cs_CZ: 'Čeština',
  de_DE: 'Deutsch',
  el_GR: 'Ελληνικά',
  en_AU: 'English (Australia)',
  en_GB: 'English (United Kingdom)',
  en_PH: 'English (Philippines)',
  en_SG: 'English (Singapore)',
  en_US: 'English (United States)',
  es_AR: 'Español (Argentina)',
  es_ES: 'Español (España)',
  es_MX: 'Español (México)',
  fr_FR: 'Français',
  hu_HU: 'Magyar',
  id_ID: 'Bahasa Indonesia',
  it_IT: 'Italiano',
  ja_JP: '日本語',
  ko_KR: '한국어',
  pl_PL: 'Polski',
  pt_BR: 'Português (Brasil)',
  ro_RO: 'Română',
  ru_RU: 'Русский',
  th_TH: 'ไทย',
  tr_TR: 'Türkçe',
  vi_VN: 'Tiếng Việt',
  zh_CN: '简体中文',
  zh_MY: '简体中文 (马来西亚)',
  zh_TW: '繁體中文'
}

/** Código ISO do país para arquivo SVG em src/renderer/public/flags/. */
export const LOCALE_FLAG_CODES: Record<AppLocale, string> = {
  ar_AE: 'ae',
  cs_CZ: 'cz',
  de_DE: 'de',
  el_GR: 'gr',
  en_AU: 'au',
  en_GB: 'gb',
  en_PH: 'ph',
  en_SG: 'sg',
  en_US: 'us',
  es_AR: 'ar',
  es_ES: 'es',
  es_MX: 'mx',
  fr_FR: 'fr',
  hu_HU: 'hu',
  id_ID: 'id',
  it_IT: 'it',
  ja_JP: 'jp',
  ko_KR: 'kr',
  pl_PL: 'pl',
  pt_BR: 'br',
  ro_RO: 'ro',
  ru_RU: 'ru',
  th_TH: 'th',
  tr_TR: 'tr',
  vi_VN: 'vn',
  zh_CN: 'cn',
  zh_MY: 'my',
  zh_TW: 'tw'
}

/** Caminho da bandeira SVG no renderer (Windows nao renderiza emoji de bandeira). */
export function flagAsset(locale: AppLocale): string {
  return `./flags/${LOCALE_FLAG_CODES[locale]}.svg`
}

export function localeLabel(locale: AppLocale): string {
  return LOCALE_DISPLAY_NAMES[locale]
}

export function bcp47(locale: AppLocale): string {
  return locale.replace('_', '-')
}
