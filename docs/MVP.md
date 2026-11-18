# MVP - League of Legends Spell Timer

## Fatia

Overlay de PC usável em partida: conta/região/API Key -> 5 inimigos -> timers manuais + config de overlay + artefato Windows distribuível. **Não** é Slot A; polish/release em ~1-3 meses quando houver tempo lateral.

## Entregáveis

1. Janela do programa com nome, tag, região e Riot API Key (persistência local)
2. Preenchimento dos 5 inimigos da partida ativa (campeão + summoner spells)
3. Clique para iniciar/cancelar cooldown com contagem regressiva (cooldowns base)
4. Overlay always-on-top: posição fixa, trava, opacidade, tamanho de fonte
5. `npm run dist` gerando zip Windows documentado no README

## Critérios de aceite

- [ ] Conta resolve e lista inimigos com spells corretas
- [ ] Timer inicia/cancela e conta regressivamente
- [ ] Overlay permanece utilizável sem "roubar" o fluxo de clique do LoL de forma abusiva
- [ ] Release zip/unpacked documentado e testável
- [ ] Sem secrets no git; CI verde no fluxo `feature` -> `hml`

## Estimativa

**~1-3 meses** de polish/release (projeto lateral; não compete com Slot A).
