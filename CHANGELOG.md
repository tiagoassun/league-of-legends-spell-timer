<!-- CHANGELOG:HEADER:START -->
# CHANGELOG - league-of-legends-spell-timer

Registro diário deste projeto (decisões, código, infra, deploy, testes, bloqueios, docs).

**Antes de editar:** leia `/d/Docs Locais/Git/__Confg-Projetos/skills/CHANGELOG-SKILL.md`.

**Canônico deste repo:** `CHANGELOG.md` (raiz)

**Janela de leitura:** desde o dia 15 do mês anterior até hoje.

**Ordem:** mais recentes no topo.

Tipos: `decisao` | `codigo` | `infra` | `teste` | `deploy` | `docs` | `bloqueio` | `atualizacao`

<!-- CHANGELOG:HEADER:END -->

## 2026-11-18

- `[docs]` Primeira carga desta sessão no diário: o trabalho concreto do Spell Timer neste fio aconteceu em grande parte em 06/10/2026 (overlay, ícone, empacote, GitHub Releases, scripts locais). Em 18/11/2026 o pedido foi registrar tudo com detalhe, sem commit/push. A entrada de 17/11 (pasta `IA/` / ciclo acadêmico) não cobre esse fio; nada a anti-duplicar dali.
- `[decisao]` Aceitou lote de UX do overlay: abrir sempre destravado (pin solto; quem quiser trava de novo), borda amarela de hover nas spells/habilidades bem visível mesmo com click-through, trocar o ícone padrão do Electron por um temático do Spell Timer / LoL na janela, barra de tarefas e `.exe`, rebuild, reinício e empacote local da release.
- `[codigo]` No processo principal, forçou `overlay.locked = false` ao abrir o overlay, persistiu em `ui-settings` / perfil ativo e retransmitiu o painel. Reforçou o hover no CSS (`.spell:hover` e classe `.is-hover`) com borda `#f0d078`, box-shadow e outline para o amarelo não sumir sob click-through.
- `[codigo]` Gerou `build/icon.ico` multi-resolução a partir do asset (o arquivo que parecia PNG era JPEG; conversão correta via Pillow). Configurou `package.json` do electron-builder com `icon` / `win.icon`, `buildResources` e `extraResources` para levar o ICO no pacote. No main: `app.setAppUserModelId('com.tiago.lol-spell-timer')`, `applyWindowIcon` com `nativeImage` + `setIcon` na janela principal e no overlay, e busca do ICO em `resources`, `__dirname/../../build` e `app.getAppPath()`.
- `[bloqueio]` Depois desse lote, o overlay deixou de arrastar e o ícone do app ainda parecia o átomo do Electron. Causa do arraste: `-webkit-app-region: drag` não funciona bem junto com `setIgnoreMouseEvents(true, { forward: true })`. Causa do ícone: cache/atalho antigo da barra e empacote unsigned; no Windows o ícone da taskbar depende de AppUserModelId + ICO + atalho coerente.
- `[codigo]` Lote seguinte aprovado: removeu `app-region: drag` da titlebar do overlay e implementou arraste manual por IPC (`overlay:drag-start` / `drag-move` / `drag-end`) com offset em tela, `setPosition`, e trava de reativar click-through durante o drag (`overlayDragging` no renderer + guarda no main). Preload e `api.d.ts` expuseram `startOverlayDrag`, `moveOverlayDrag`, `endOverlayDrag`. Rebuild e reempacote local (`release/win-unpacked`, zip `Spell-Timer-0.1.0-win-x64.zip`).
- `[teste]` Em 06/10 o `Spell Timer.exe` empacotado não abria: mensagem de política de Controle de Aplicativo bloqueando o arquivo; no bash aparecia Permission denied / Acesso negado. O mesmo projeto subia normalmente via `node_modules/electron/dist/electron.exe` apontando para a pasta do repo (janela `LoL Spell Timer`). Notificação do Windows: "Parte deste aplicativo foi bloqueado" citando `bash.exe` e publicador não confirmado de `Spell Timer.exe` (app sem assinatura de código).
- `[decisao]` Para uso diário neste PC, passou a abrir pelo Electron do repositório (não pelo `.exe` do `win-unpacked` bloqueado). Pedido de fixar na barra: o processo genérico "Electron" não pinava com cara de produto. Recusou Menu Iniciar como solução principal; queria pin na barra de tarefas e reclamou que o ícone tinha sumido de novo.
- `[codigo]` Criou scripts locais (só neste PC): `scripts/abrir-spell-timer.ps1` / `.cmd` e `scripts/instalar-atalho-spell-timer.ps1`. O instalador grava `Spell Timer.lnk` em `User Pinned\TaskBar` apontando para o Electron do repo, com ícone `build/icon.ico` e AppUserModelId `com.tiago.lol-spell-timer`, reinício do Explorer, rebuild e reopen. Explicou ao humano: Electron = Chromium (UI) + Node (sistema); o nome "Electron" na barra é o host enquanto o `.exe` empacotado estiver bloqueado.
- `[decisao]` Quis empacotar e publicar no GitHub para terceiros baixarem. Lote aprovado: branch `feature/github-release-windows`, workflow de release em tag `v*`, README com download + aviso de SmartScreen / Controle de Aplicativo, sem versionar os scripts locais de atalho, commit Conventional Commits tipo `ci`, push, pull request para `hml`, depois tag `v0.1.0` e Release.
- `[bloqueio]` O GitHub CLI no terminal não estava autenticado (`gh auth login` pendente; sem `GH_TOKEN`). Conector do Cursor e MCP GitHub autenticaram, mas o CLI ainda faltava. Fluxo web device: código de uso único e https://github.com/login/device; concluiu login como `tiagoassun` (keyring, HTTPS, scopes gist/read:org/repo).
- `[codigo]` Adicionou `.github/workflows/release.yml`: runner `windows-latest`, `npm ci`, `npm run dist`, localiza `release/Spell-Timer-*-win-x64.zip`, publica com `softprops/action-gh-release@v2` e `GITHUB_TOKEN`. README ganhou seção "Baixar (GitHub Releases)" com link https://github.com/tiagoassun/league-of-legends-spell-timer/releases e aviso de app unsigned.
- `[deploy]` Mergeou o pull request #10 (`feature/github-release-windows` -> `hml`). Criou e enviou a tag anotada `v0.1.0`. Workflow `release` run 37535534808 concluiu com sucesso; Release público https://github.com/tiagoassun/league-of-legends-spell-timer/releases/tag/v0.1.0 com asset `Spell-Timer-0.1.0-win-x64.zip`. CI de build no pull request passou antes do merge.
- `[decisao]` Os três scripts locais continuaram untracked e o Cursor mostrava "falta commit". Humano não gostou do ruído visual. Lote: ignorá-los no `.gitignore` (arquivos ficam no disco), branch `feature/gitignore-scripts-locais`, commit `chore: ignora scripts locais do Spell Timer no Git`, pull request #11 -> `hml`. Mergeou o #11; working tree limpa em `hml`.
- `[bloqueio]` Pendências conscientes deste fio: (1) promoção `hml` -> `main` do release/gitignore ainda não pedida; (2) `Spell Timer.exe` unsigned continua sujeito a SmartScreen / Controle de Aplicativo em qualquer PC, inclusive quem baixar o zip do Release; (3) certificado de código (OV/EV) não comprado; (4) scripts de atalho são gambiarra local, não fazem parte do artefato público.

## 2026-11-17

- `[docs]` Criou a pasta `IA/` com as 15 etapas do ciclo de vida acadêmico e centralizou as etapas em `__Confg-Projetos/IA/` e manteve o diário na raiz deste repo. O `__Confg-Projetos` volta a ser portfólio; detalhe de engenharia fica neste repo.
