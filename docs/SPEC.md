# SPEC - League of Legends Spell Timer

## Problema

No chat do LoL muita gente marca `f 30`, `tp bot 1:20`, etc. Em mobile existem companions de spell timer; no PC falta algo simples, separado do cliente, por cima do jogo **sem atrapalhar o clique**.

## Visão de produto

- Overlay desktop always-on-top com timers manuais das summoner spells inimigas
- Resolução de conta/partida via Riot API (nome, tag, região, API Key do usuário)
- Configuração de overlay (opacidade, fonte, trava) sem ser companion mobile

## Requisitos funcionais

| ID | Requisito | Horizonte |
| --- | --- | --- |
| RF01 | Informar nome de jogo, tag, região e Riot API Key; persistir localmente | MVP |
| RF02 | Resolver conta e preencher os 5 inimigos (campeão + spells) da partida ativa | MVP |
| RF03 | Clique inicia/cancela cooldown com contagem regressiva | MVP |
| RF04 | Overlay always-on-top, posição fixa, trava de arraste, opacidade e fonte | MVP |
| RF05 | Release Windows (zip / pasta unpacked) documentado | MVP |
| RF06 | Auto-detecção via Live Client Data (sem digitar nick) | ~metade |
| RF07 | Haste de runas/itens nos cooldowns | ~metade |
| RF08 | Presets de layout e atalhos de teclado | completo |

## Requisitos não funcionais

- Sem injection / leitura ilegal de memória do cliente
- Overlay não deve roubar cliques/foco do jogo de forma abusiva
- API Key só em armazenamento local do usuário - nunca no git
- Conventional commits; fluxo `feature` -> `hml` -> `main`
- **Proibido** `workflow_run` a partir de `main` para encadear HML
