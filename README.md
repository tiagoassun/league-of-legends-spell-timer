# League of Legends Spell Timer

Overlay de PC para tracking de summoner spells do time inimigo no League of Legends.

O problema que resolve: no chat muita gente marca `f 30`, `tp bot 1:20`, etc. No celular existem apps como companions de spell timer; no PC falta algo simples, separado do cliente, que fique por cima do jogo sem atrapalhar o clique.

## O que é

- App **separado** da janela do LoL (não é overlay embedado no cliente).
- Janela **sempre no topo** (`always on top`).
- Você informa o **nome de jogo**, a **tag** e a **região**; o app busca a partida ativa e monta o time inimigo com campeão e summoner spells.
- Você marca quando um inimigo usou Flash, Teleport, Ignite, etc.; o app conta o cooldown.
- Posição **fixa na tela**: se você arrastar a janela do LoL, o spell timer **não** acompanha.
- Opção de **travar a janela**: com a trava ligada, não dá para arrastar/redimensionar o overlay sem querer (comum com ele por cima do LoL).
- Ajuste de **tamanho** e **opacidade** da janela (dá para deixar mais transparente por cima do jogo).
- Cliques no jogo não devem "tirar" o overlay do lugar útil (companion por cima, sem roubar o foco do LoL).

Referência de produto (mobile): [LOL Spell Timer - Spell Check](https://play.google.com/store/apps/details?id=com.mmgames.lolspell&hl=pt_BR).

## Fluxo de uso (previsto)

1. Abrir o spell timer e informar **nome de jogo**, **tag** e **região** (ex.: `TI C137` + `C137` + Brasil).
2. O app resolve a conta, detecta a partida ativa e preenche os 5 inimigos (campeão + spells).
3. Ajustar tamanho e opacidade; posicionar onde for confortável e, se quiser, **travar** para não arrastar sem querer.
4. Ao ver/ouvir uma summoner spell inimiga, clicar no ícone correspondente.
5. Acompanhar os timers até o cooldown voltar.

## Escopo do MVP (previsto)

- Campos separados: **nome de jogo**, **tag** e **região** + busca da partida ativa (Riot API / spectator).
  - Ex.: nome `TI C137`, tag `C137` (sem digitar `#` nem juntar tudo num campo só).
  - Região obrigatória para a API (ex.: Brasil / `br1`).
- Lista dos 5 inimigos já preenchida com campeão e summoner spells.
- Clique para iniciar cooldown; contagem regressiva visível.
- Cooldowns base das spells (Flash, Teleport, Ignite, Heal, Exhaust, Barrier, Cleanse, Ghost, Smite).
- Janela always-on-top, separada do LoL, posição fixa no desktop.
- Ajuste de tamanho (escala) e opacidade / transparência da janela.
- Ajuste manual de posição da janela do timer.
- Travar / destravar a janela (bloqueia arrastar e redimensionar; opacidade continua ajustável).

Candidatos a fases seguintes: auto-detecção via Live Client Data (cliente local, sem digitar o nick), haste de runas/itens, presets de layout, atalhos de teclado.

## Fora do produto

- Modificação do cliente do LoL / memória / injection.
- Automação de jogo ou leitura ilegal do cliente.
- Substituir o próprio julgamento em fight - só organiza o tracking.

## Stack prevista

- App desktop para Windows (detalhes de framework a definir na implementação).
- Riot Games API (conta + partida ativa / spectator) para montar o time inimigo.
- UI leve focada em ícones + timers.

## Status

Projeto em definição de escopo. O README descreve a intenção de produto; a implementação ainda não começou.

## Licença

MIT - ver [LICENSE](LICENSE).
