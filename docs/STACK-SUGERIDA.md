# STACK SUGERIDA - League of Legends Spell Timer

**Já adotada no repo** (não reinventar sem RFC):

| Camada | Tecnologia |
| --- | --- |
| Desktop | Electron + TypeScript + Vite (`electron-vite`) |
| Processo principal | Riot API (Account-V1 + Spectator-V5) |
| Assets | Data Dragon CDN |
| Release | `npm run dist` -> zip Windows / `win-unpacked` |

## Evolução sugerida (sem quebrar MVP)

- Live Client Data no main process (pós-MVP)
- Testes de unidade nos timers/cooldowns
- CI GitHub Actions em PR/push para `hml` e `main`
