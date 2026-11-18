# _14 - League of Legends Spell Timer

Overlay de PC para tracking de summoner spells do time inimigo no League of Legends. **Projeto lateral finalizado** (fora do ranking 1-15; não compete com Slot A).

| Campo | Valor |
| --- | --- |
| Repo | [tiagoassun/league-of-legends-spell-timer](https://github.com/tiagoassun/league-of-legends-spell-timer) |
| Path local | `/d/Docs Locais/Git/league-of-legends-spell-timer` |
| Prioridade | Lateral finalizado - fora da lista 1-14 |
| Stack | Electron + TypeScript + Vite (`electron-vite`) |

## O que é

- Janela do programa (conta, tag, região, Riot API Key) e overlay separado (inimigos + timers).
- Overlay always-on-top, posição fixa no desktop, trava, opacidade e fonte próprias.
- Clique no ícone inicia/cancela cooldown; não é companion mobile.
- Cliques no jogo não devem roubar o overlay do lugar útil (sem roubar foco do LoL).

## Horizontes

| Horizonte | Expectativa | Calendário |
| --- | --- | --- |
| MVP | Overlay usável + busca de partida + release Windows zip | ~1-3 meses polish/release |
| ~metade | Live Client Data / auto-detecção, haste de runas/itens | intercalado |
| completo | Presets, atalhos, polish de distribuição | quando fizer sentido |

## Documentos irmãos

- [SPEC.md](./SPEC.md)
- [MVP.md](./MVP.md)
- [ROADMAP.md](./ROADMAP.md)
- [AGENTS.md](./AGENTS.md)
- [FONTES-DADOS.md](./FONTES-DADOS.md)
- [STACK-SUGERIDA.md](./STACK-SUGERIDA.md)
- [RISCOS.md](./RISCOS.md)
- [FORA-DE-ESCOPO.md](./FORA-DE-ESCOPO.md)
- [DEFINICAO-DE-PRONTO.md](./DEFINICAO-DE-PRONTO.md)
