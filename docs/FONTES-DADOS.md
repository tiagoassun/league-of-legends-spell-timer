# FONTES DE DADOS - League of Legends Spell Timer

## Fontes externas

| Fonte | Uso | Cuidados |
| --- | --- | --- |
| Riot Games API (Account-V1, Spectator-V5) | Conta + partida ativa + inimigos | API Key do usuário; rate limit; ToS Riot |
| Data Dragon (CDN) | Ícones de campeões/spells | CDN pública; cache local se fizer sentido |
| Live Client Data (localhost do cliente) | Auto-detecção pós-MVP | Só endpoints oficiais; sem memory read |

## Dados locais

| Entidade | Origem | Notas |
| --- | --- | --- |
| Perfil (nome, tag, região, API Key) | Usuário | Persistência local; não versionar |
| Preferências de overlay | Usuário | Opacidade, fonte, posição, trava |
| Timers ativos | Sessão | Estado em memória da partida |

## Privacidade

- API Key é segredo do usuário - nunca commit, log verboso ou upload remoto
- Sem telemetria de terceiros sem opt-in
