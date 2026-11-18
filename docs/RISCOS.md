# RISCOS - League of Legends Spell Timer

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Violação ToS Riot (injection/hack) | Alto | Só APIs oficiais; sem memória/cliente modificado |
| Overlay rouba cliques/foco | Alto | Click-through / always-on-top cuidadoso; testar em partida |
| Rate limit / API Key inválida | Médio | Backoff, mensagens claras, persistência local da key |
| Escopo "companion completo" atrasando polish | Médio | Travar MVP overlay + timers manuais |
| Windows Defender bloqueando release | Médio | Preferir zip/pasta unpacked; documentar |
| Confundir prioridade com Slot A | Médio | Lateral explícito; não competir com 1-11 |

## Operação

- Não há stack Portainer obrigatória para o runtime
- Secrets só no perfil local do usuário
