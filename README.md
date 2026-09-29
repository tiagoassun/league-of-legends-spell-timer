# League of Legends Spell Timer

Overlay de PC para tracking de summoner spells do time inimigo no League of Legends.

O problema que resolve: no chat muita gente marca `f 30`, `tp bot 1:20`, etc. No celular existem apps como companions de spell timer; no PC falta algo simples, separado do cliente, que fique por cima do jogo sem atrapalhar o clique.

## O que é

- Janela do **programa** (conta, tag, região, API Key) e janela de **overlay** (inimigos + timers) separadas.
- Overlay **sempre no topo**, com trava, opacidade e fonte proprias.
- Configuração separada: **Config do programa** e **Config do overlay**.
- Você marca quando um inimigo usou Flash, Teleport, Ignite, etc.; o app conta o cooldown.
- Posição **fixa na tela**: se você arrastar a janela do LoL, o spell timer **não** acompanha.
- Opção de **travar a janela**: com a trava ligada, nao da para arrastar sem querer.
- Ajuste de **opacidade** e **tamanho da fonte** na seção Configuração. Em ambas as janelas, a fonte redefine o tamanho automaticamente (sem redimensionar pelas bordas).
- Cliques no jogo nao devem "tirar" o overlay do lugar util (companion por cima, sem roubar o foco do LoL).

Referência de produto (mobile): [LOL Spell Timer - Spell Check](https://play.google.com/store/apps/details?id=com.mmgames.lolspell&hl=pt_BR).

## Fluxo de uso

1. Abrir o spell timer e informar **nome de jogo**, **tag**, **região** e **Riot API Key** (tudo na janela; salva sozinho na proxima abertura).
2. O app resolve a conta, detecta a partida ativa e preenche os 5 inimigos (campeão + spells).
3. Abrir **Config** (janela a parte) para opacidade e tamanho da fonte; posicionar o overlay e, se quiser, **travar**.
4. Ao ver/ouvir uma summoner spell inimiga, clicar no ícone correspondente.
5. Acompanhar os timers até o cooldown voltar. Clique de novo no ícone cancela o timer.

## Escopo do MVP

- Campos na janela: **nome de jogo**, **tag**, **região** e **Riot API Key** + busca da partida ativa.
  - Ex.: nome `TI C137`, tag `C137` (sem digitar `#` nem juntar tudo num campo só).
  - Região obrigatória para a API (ex.: Brasil / `br1`).
  - API Key do usuario (portal Riot); o app guarda no perfil local automaticamente (sem editar `.env`).
- Lista dos 5 inimigos já preenchida com campeão e summoner spells.
- Clique para iniciar cooldown; contagem regressiva visível.
- Cooldowns base das spells (Flash, Teleport, Ignite, Heal, Exhaust, Barrier, Cleanse, Ghost, Smite, etc.).
- Janela always-on-top, separada do LoL, posição fixa no desktop.
- Janela **Configuração** separada (botão Config): opacidade compacta + tamanho da fonte numérico.
- Ajuste manual de posição (arrastar). Tamanho acompanha a fonte (programa e overlay).
- Travar / destravar (bloqueia arrastar). Config de fonte/opacidade continua disponivel.

Candidatos a fases seguintes: auto-detecção via Live Client Data (cliente local, sem digitar o nick), haste de runas/itens, presets de layout, atalhos de teclado.

## Fora do produto

- Modificação do cliente do LoL / memória / injection.
- Automação de jogo ou leitura ilegal do cliente.
- Substituir o próprio julgamento em fight - só organiza o tracking.

## Stack

- Electron + TypeScript + Vite (`electron-vite`)
- Riot Games API (Account-V1 + Spectator-V5) no processo principal
- Ícones via Data Dragon (CDN)

## Como rodar (desenvolvimento)

1. Node.js 20+ instalado.
2. `npm install`
3. `npm run dev`
4. Na janela: nome, tag, região e a Riot API Key ([portal Riot](https://developer.riotgames.com/)).

Opcional em desenvolvimento: `.env` com `RIOT_API_KEY` ainda funciona como fallback se o campo da UI estiver vazio.

## Release Windows (sem instalador)

Gera um zip com a pasta do app (não usa `.exe` portable - o Windows costuma bloquear esse formato sem certificado):

```bash
npm run dist
```

Saída em `release/`:

- `Spell-Timer-0.1.0-win-x64.zip` - artefato para distribuir (GitHub Releases)
- `win-unpacked/` - pasta já extraída para testar localmente (`Spell Timer.exe`)

Como usar:

1. Extraia o zip (ou use `win-unpacked` direto).
2. Abra `Spell Timer.exe` pelo Explorer.
3. Se o Windows pedir, em Propriedades marque **Desbloquear**.

Para só gerar a pasta sem zip: `npm run dist:dir`.

### Armadilhas (não repetir)

**Não** defina `build.win.signAndEditExecutable: false` no `package.json`.

- Com o valor padrão (`true`), o electron-builder atualiza a integridade do `app.asar` no `.exe` e passa pelo `signtool` (mesmo sem certificado de código comprado). Esse é o empacotamento que abre normalmente no Windows deste projeto.
- Com `false`, o `.exe` sai diferente e o **Smart App Control** / segurança do Windows pode bloquear a abertura **sem mensagem clara**, ou passar a mostrar bloqueio onde antes abria. Já aconteceu aqui: a pasta `win-unpacked` deixou de abrir depois dessa flag e voltou a abrir ao removê-la.

**Não** use target `portable` (`.exe` único autoextrator) como artefato principal: no PC com Smart App Control ativo ele tende a falhar; o zip / `win-unpacked` é o caminho suportado.

Certificado de assinatura de código (OV/EV) continua opcional e caro; não é necessário para o zip local, mas quem baixar de outro PC ainda pode ver aviso do Windows.

## Estrutura

```text
src/
  main/          # janela Electron, IPC, sempre no topo
  preload/       # bridge segura para o renderer
  renderer/      # UI (index, overlay, settings) + public/flags
  shared/        # regiões, spells, cliente Riot, i18n, tipos
release/         # saída do electron-builder (gitignored)
```

## Status

MVP inicial implementado. Haste de runas/itens e Live Client Data ficam para fases seguintes.

## Licença

MIT - ver [LICENSE](LICENSE).
