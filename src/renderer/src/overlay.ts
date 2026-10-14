import type {
  AbilityInfo,
  ActiveMatchPayload,
  CooldownTrackInfo,
  EnemyPlayer,
  PanelSettings,
  SpellSlot,
  SpellTimerState,
  SummonerSpellInfo
} from '../../shared/types'
import {
  bcp47,
  DEFAULT_LOCALE,
  type AppLocale,
  type MessageKey,
  t
} from '../../shared/i18n'

const enemiesEl = document.querySelector<HTMLElement>('#enemies')!
const lockBtn = document.querySelector<HTMLButtonElement>('#btn-lock')!
const configBtn = document.querySelector<HTMLButtonElement>('#btn-config')!
const minBtn = document.querySelector<HTMLButtonElement>('#btn-min')!
const closeBtn = document.querySelector<HTMLButtonElement>('#btn-close')!
const shell = document.querySelector<HTMLElement>('#app')!
const brandEl = document.querySelector<HTMLElement>('.brand')!

const timers = new Map<string, SpellTimerState>()
/** Expand de itens por inimigo. Padrao: spells + habilidades + passiva. */
const expandItems = new Set<string>()
let match: ActiveMatchPayload | null = null
let settings: PanelSettings = { locked: false, opacity: 0.92, fontSize: 16 }
let locale: AppLocale = DEFAULT_LOCALE
let tickHandle: number | null = null
let listenersBound = false

function tr(key: MessageKey, vars?: Record<string, string | number>): string {
  return t(locale, key, vars)
}

function timerKey(puuid: string, slot: SpellSlot): string {
  return `${puuid}:${slot}`
}

function applyStaticI18n(): void {
  document.documentElement.lang = bcp47(locale)
  if (brandEl) brandEl.textContent = tr('overlay.brand')
  configBtn.title = tr('overlay.configTitle')
  configBtn.setAttribute('aria-label', tr('overlay.configAria'))
  minBtn.title = tr('overlay.minimize')
  closeBtn.title = tr('overlay.close')
  applyLockCopy()
}

function applyLockCopy(): void {
  lockBtn.title = settings.locked ? tr('overlay.unlock') : tr('overlay.lock')
  lockBtn.setAttribute(
    'aria-label',
    settings.locked ? tr('overlay.unlockAria') : tr('overlay.lockAria')
  )
}

function applySettingsToUi(next: PanelSettings): void {
  settings = next
  shell.classList.toggle('locked', next.locked)
  lockBtn.classList.toggle('active', next.locked)
  lockBtn.classList.toggle('pinned', next.locked)
  applyLockCopy()
  document.documentElement.style.fontSize = `${next.fontSize}px`
  void fitToContent()
}

function remainingSeconds(state: SpellTimerState, now: number): number {
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000))
}

/** >= 60s mostra m:ss (ex.: 97 -> 1:37). */
function formatCooldownSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total))
  if (s < 60) return String(s)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const OVERLAY_BUTTONS = 'button.spell, button.row-expand, button.icon-btn'

function isOverlayCaptureTarget(el: Element | null): boolean {
  if (!el) return false
  if (el.closest(OVERLAY_BUTTONS)) return true
  // Barra superior inteira captura clique para arrastar (quando nao travada).
  if (!settings.locked && el.closest('.titlebar')) return true
  return false
}

let lastIgnoreMouse: boolean | null = null
let overlayDragging = false

function setIgnoreMouse(ignore: boolean): void {
  if (overlayDragging && ignore) return
  if (lastIgnoreMouse === ignore) return
  lastIgnoreMouse = ignore
  window.spellTimer.setOverlayIgnoreMouseEvents(ignore)
}

function syncIgnoreMouseFromPoint(x: number, y: number): void {
  const el = document.elementFromPoint(x, y)
  const capture = isOverlayCaptureTarget(el instanceof Element ? el : null)
  setIgnoreMouse(!capture)
}

function bindOverlayClickThrough(): void {
  let hoverSpell: HTMLElement | null = null

  const syncHoverFromPoint = (x: number, y: number): void => {
    const el = document.elementFromPoint(x, y)
    const spell = el instanceof Element ? el.closest<HTMLElement>('button.spell') : null
    if (hoverSpell && hoverSpell !== spell) {
      hoverSpell.classList.remove('is-hover')
    }
    if (spell && spell !== hoverSpell) {
      spell.classList.add('is-hover')
    }
    hoverSpell = spell
  }

  const clearHover = (): void => {
    if (hoverSpell) {
      hoverSpell.classList.remove('is-hover')
      hoverSpell = null
    }
  }

  const onMove = (event: PointerEvent): void => {
    syncIgnoreMouseFromPoint(event.clientX, event.clientY)
    syncHoverFromPoint(event.clientX, event.clientY)
  }
  // mouseover no capture: liga a janela ANTES do clique (forward do Electron).
  const onOver = (event: Event): void => {
    const target = event.target
    if (target instanceof Element && isOverlayCaptureTarget(target)) {
      setIgnoreMouse(false)
    }
    if (target instanceof Element) {
      const spell = target.closest<HTMLElement>('button.spell')
      if (hoverSpell && hoverSpell !== spell) {
        hoverSpell.classList.remove('is-hover')
      }
      if (spell && spell !== hoverSpell) {
        spell.classList.add('is-hover')
      }
      hoverSpell = spell
    }
  }
  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('mouseover', onOver, true)
  document.addEventListener(
    'pointerleave',
    () => {
      setIgnoreMouse(true)
      clearHover()
    },
    { passive: true }
  )
  setIgnoreMouse(true)
}

function bindOverlayTitlebarDrag(): void {
  const titlebar = document.querySelector('.titlebar')
  if (!(titlebar instanceof HTMLElement)) return

  titlebar.addEventListener('pointerdown', (event: PointerEvent) => {
    if (settings.locked) return
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('button, .titlebar-tools, .titlebar-actions')) return

    event.preventDefault()
    overlayDragging = true
    setIgnoreMouse(false)
    titlebar.classList.add('is-dragging')
    titlebar.setPointerCapture(event.pointerId)
    window.spellTimer.startOverlayDrag({ screenX: event.screenX, screenY: event.screenY })

    const onMove = (moveEvent: PointerEvent): void => {
      window.spellTimer.moveOverlayDrag({
        screenX: moveEvent.screenX,
        screenY: moveEvent.screenY
      })
    }

    const onUp = (upEvent: PointerEvent): void => {
      overlayDragging = false
      titlebar.classList.remove('is-dragging')
      titlebar.releasePointerCapture(upEvent.pointerId)
      titlebar.removeEventListener('pointermove', onMove)
      titlebar.removeEventListener('pointerup', onUp)
      titlebar.removeEventListener('pointercancel', onUp)
      window.spellTimer.endOverlayDrag()
      syncIgnoreMouseFromPoint(upEvent.clientX, upEvent.clientY)
    }

    titlebar.addEventListener('pointermove', onMove)
    titlebar.addEventListener('pointerup', onUp)
    titlebar.addEventListener('pointercancel', onUp)
  })
}

function setMatch(next: ActiveMatchPayload | null): void {
  const sameLive =
    Boolean(match && next && match.source === 'live' && next.source === 'live') &&
    match!.gameId === next!.gameId

  match = next
  if (!sameLive) {
    timers.clear()
    expandItems.clear()
  } else if (next) {
    const ids = new Set(next.enemies.map((e) => e.puuid))
    for (const id of Array.from(expandItems)) {
      if (!ids.has(id)) expandItems.delete(id)
    }
  }
  renderEnemies({ fit: true })
}

async function waitForImages(): Promise<void> {
  const images = Array.from(enemiesEl.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
    )
  )
}

async function fitToContent(): Promise<void> {
  await waitForImages()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  void shell.offsetWidth
  const width = Math.ceil(Math.max(shell.scrollWidth, shell.offsetWidth) + 4)
  const height = Math.ceil(Math.max(shell.scrollHeight, shell.offsetHeight) + 4)
  if (width < 80 || height < 60) return

  await window.spellTimer.fitOverlay({ width, height })
}

function bindEnemyClicks(): void {
  if (listenersBound) return
  listenersBound = true
  enemiesEl.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return

    const expandBtn = target.closest<HTMLButtonElement>('button.row-expand')
    if (expandBtn && enemiesEl.contains(expandBtn)) {
      event.preventDefault()
      const puuid = expandBtn.dataset.puuid
      if (!puuid || expandBtn.dataset.expand !== 'items') return
      toggleItemsExpand(puuid)
      return
    }

    const button = target.closest<HTMLButtonElement>('button.spell')
    if (!button || !enemiesEl.contains(button)) return
    if (button.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()
    const puuid = button.dataset.puuid
    const slot = button.dataset.slot as SpellSlot | undefined
    const cooldown = Number(button.dataset.cooldown)
    if (!puuid || !slot || !Number.isFinite(cooldown) || cooldown <= 0) return
    toggleTimer(puuid, slot, cooldown)
  })
}

function toggleItemsExpand(puuid: string): void {
  if (expandItems.has(puuid)) expandItems.delete(puuid)
  else expandItems.add(puuid)
  renderEnemies({ fit: true })
}

function expandItemsButton(puuid: string, open: boolean, enabled: boolean): string {
  const titleKey = open ? 'overlay.collapseItems' : 'overlay.expandItems'
  const disabled = enabled ? '' : 'disabled'
  return `
    <button
      type="button"
      class="row-expand items ${open ? 'open' : ''}"
      title="${tr(titleKey)}"
      aria-label="${tr(titleKey)}"
      aria-expanded="${open ? 'true' : 'false'}"
      data-puuid="${puuid}"
      data-expand="items"
      ${disabled}
    >
      <span class="caret" aria-hidden="true"></span>
    </button>
  `
}

function enemyCard(enemy: EnemyPlayer, now: number): string {
  const abilities = enemy.abilities
  const passive = enemy.passive
  const items = enemy.cooldownItems ?? []
  const showItems = expandItems.has(enemy.puuid)
  const hasItemPanel = items.length > 0

  const abilityRow = abilities
    ? `
        <div class="spells abilities">
          ${abilityButton(enemy, 'Q', abilities.Q, now)}
          ${abilityButton(enemy, 'W', abilities.W, now)}
          ${abilityButton(enemy, 'E', abilities.E, now)}
          ${abilityButton(enemy, 'R', abilities.R, now)}
        </div>`
    : ''

  const itemsRow =
    showItems && items.length
      ? `
        <div class="spells items">
          ${items
            .map((item) => trackButton(enemy, `item:${item.key}` as SpellSlot, item, now))
            .join('')}
        </div>`
      : ''

  const ahTitle = 'Ability Haste (Aceleração de Habilidade)'
  const ahBit =
    typeof enemy.abilityHaste === 'number'
      ? ` · <span class="ah" title="${ahTitle}">AH ${enemy.abilityHaste}</span>`
      : ''
  const lvBit = typeof enemy.level === 'number' ? ` · Nv ${enemy.level}` : ''

  const passiveHtml = passive
    ? spellButton(enemy, 'P', passive, now, 'spell-passive')
    : ''

  return `
    <article class="enemy">
      <div class="enemy-head">
        <div class="enemy-name">${enemy.championName}</div>
        <div class="enemy-sub">${enemy.riotId}${ahBit}${lvBit}</div>
      </div>
      <div class="enemy-row">
        <div class="champ-col">
          <img class="champ" src="${enemy.championIconUrl}" alt="${enemy.championName}" />
          ${passiveHtml}
        </div>
        <div class="spell-stacks">
          <div class="summoner-line">
            <div class="spells summoners">
              ${spellButton(enemy, 'spell1', enemy.spell1, now)}
              ${spellButton(enemy, 'spell2', enemy.spell2, now)}
            </div>
            ${expandItemsButton(enemy.puuid, showItems, hasItemPanel)}
          </div>
          ${abilityRow}
          ${itemsRow}
        </div>
      </div>
    </article>
  `
}

function paintTimers(): void {
  const now = Date.now()
  enemiesEl.querySelectorAll<HTMLButtonElement>('button.spell').forEach((button) => {
    const puuid = button.dataset.puuid
    const slot = button.dataset.slot as SpellSlot | undefined
    if (!puuid || !slot) return
    const state = timers.get(timerKey(puuid, slot))
    const left = state ? remainingSeconds(state, now) : 0
    const ready = left <= 0
    button.classList.toggle('ready', ready)
    const cd = button.querySelector<HTMLElement>('.cd')
    if (cd) {
      cd.textContent = formatCooldownSeconds(left)
      cd.classList.toggle('long', left >= 60)
    }
  })
}

function renderEnemies(options?: { fit?: boolean }): void {
  if (!match || match.enemies.length === 0) {
    enemiesEl.innerHTML = `<p class="empty">${tr('overlay.empty')}</p>`
    if (options?.fit) void fitToContent()
    return
  }

  const now = Date.now()
  enemiesEl.innerHTML = match.enemies.map((enemy) => enemyCard(enemy, now)).join('')
  bindEnemyClicks()
  if (options?.fit) void fitToContent()
}

function abilityButton(
  enemy: EnemyPlayer,
  slot: 'Q' | 'W' | 'E' | 'R',
  ability: AbilityInfo,
  now: number
): string {
  return spellButton(enemy, slot, ability, now)
}

function trackButton(
  enemy: EnemyPlayer,
  slot: SpellSlot,
  track: CooldownTrackInfo,
  now: number
): string {
  return spellButton(enemy, slot, track, now)
}

function spellButton(
  enemy: EnemyPlayer,
  slot: SpellSlot,
  spell: SummonerSpellInfo | AbilityInfo | CooldownTrackInfo,
  now: number,
  extraClass = ''
): string {
  const key = timerKey(enemy.puuid, slot)
  const state = timers.get(key)
  const left = state ? remainingSeconds(state, now) : 0
  const ready = left <= 0
  const trackable = Number.isFinite(spell.cooldown) && spell.cooldown > 0
  const cls = `spell ${ready ? 'ready' : ''}${extraClass ? ` ${extraClass}` : ''}${
    trackable ? '' : ' is-untracked'
  }`.trim()
  const name = escapeAttr(spell.name)
  const cdText = formatCooldownSeconds(left)
  return `
    <button
      type="button"
      class="${cls}"
      title="${tr('overlay.spellHint', { name: spell.name, seconds: spell.cooldown })}"
      data-puuid="${escapeAttr(enemy.puuid)}"
      data-slot="${escapeAttr(slot)}"
      data-cooldown="${spell.cooldown}"
      ${trackable ? '' : 'aria-disabled="true"'}
    >
      <img src="${escapeAttr(spell.iconFile)}" alt="${name}" draggable="false" />
      <span class="cd${left >= 60 ? ' long' : ''}">${cdText}</span>
    </button>
  `
}

function toggleTimer(puuid: string, slot: SpellSlot, cooldown: number): void {
  const key = timerKey(puuid, slot)
  const existing = timers.get(key)
  if (existing && remainingSeconds(existing, Date.now()) > 0) {
    timers.delete(key)
  } else {
    timers.set(key, {
      enemyPuuid: puuid,
      slot,
      cooldown,
      endsAt: Date.now() + cooldown * 1000
    })
  }
  paintTimers()
  ensureTick()
}

function ensureTick(): void {
  if (tickHandle !== null) return
  tickHandle = window.setInterval(() => {
    const now = Date.now()
    let active = false
    for (const [key, state] of Array.from(timers.entries())) {
      if (remainingSeconds(state, now) <= 0) {
        timers.delete(key)
      } else {
        active = true
      }
    }
    paintTimers()
    if (!active && tickHandle !== null) {
      window.clearInterval(tickHandle)
      tickHandle = null
    }
  }, 250)
}

async function init(): Promise<void> {
  locale = await window.spellTimer.getLocale()
  applyStaticI18n()
  bindEnemyClicks()
  bindOverlayClickThrough()
  bindOverlayTitlebarDrag()

  settings = await window.spellTimer.getSettings('overlay')
  applySettingsToUi(settings)
  window.spellTimer.onSettingsChanged((payload) => {
    if (payload.scope === 'overlay') applySettingsToUi(payload.settings)
  })
  window.spellTimer.onLocaleChanged((next) => {
    locale = next
    applyStaticI18n()
    renderEnemies({ fit: true })
  })

  setMatch(await window.spellTimer.getMatch())
  window.spellTimer.onMatchUpdated(setMatch)

  lockBtn.addEventListener('click', () => {
    void window.spellTimer.updateSettings('overlay', { locked: !settings.locked })
  })
  configBtn.addEventListener('click', () => window.spellTimer.openSettings('overlay'))
  minBtn.addEventListener('click', () => window.spellTimer.minimize())
  closeBtn.addEventListener('click', () => window.spellTimer.close())
}

void init()
