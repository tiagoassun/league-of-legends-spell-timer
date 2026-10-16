# AGENTS.md — league-of-legends-spell-timer

Instruções para agentes neste repositório de código.

## Ordem de leitura (obrigatória)

1. Meta-repo `__Confg-Projetos`: `PRIORIDADE.md` e `WIP.md`.
2. Pasta do projeto: `d:/Docs Locais/Git/__Confg-Projetos/projetos/_13-league-of-legends-spell-timer/` — ler `AGENTS.md`, `NEXT-AGENT.md`, `SPEC.md`, `MVP.md`, `ROADMAP.md` (e demais docs conforme a tarefa) **antes** de editar código aqui.
3. Só então este repo (`league-of-legends-spell-timer`); há ponte em `NEXT-AGENT.md` na raiz (brief canônico no meta).

O meta-repo é a fonte de verdade de intenção e escopo.

## Idioma e qualidade

Antes de gravar prosa (README, docs, UI, mensagens):

1. Ler `d:/Docs Locais/Git/__Confg-Projetos/LINGUA-PT-BR.md` e obedecer.
2. Ler `d:/Docs Locais/Git/__Confg-Projetos/FAZER-CERTO-PRIMEIRA-VEZ.md` e obedecer.
## Git flow

```text
feature/<descricao-kebab>  →  hml  →  main
```

- Trabalho novo em `feature/...`.
- Integração / homologação via PR para `hml`.
- Estável via PR `hml` → `main`.
- Conventional commits.
- **Proibido** `workflow_run` disparado a partir de `main` para encadear deploy HML/prod. Deploy HML acompanha a branch `hml`.

## Homologação e produção

- Lab no **Servidor Pessoal** / **Notebook Servidor** quando houver artefato web; app desktop não depende de Portainer para o overlay.
- **Proibido** chamar esse host só de "notebook".
- URLs web (se existirem): HML com `-hml` no hostname; PRD sem sufixo (`CONVENCOES.md`).

## Notas do produto

- Projeto **lateral finalizado** (fora do ranking 1–12 / não é Slot A): overlay de PC para timers de summoner spells inimigas no LoL.
- Não é companion mobile; overlay desktop always-on-top sem roubar cliques/foco do jogo.
- Sem injection/leitura ilegal do cliente; Riot API Key fica local (UI / perfil) — não commitar secrets.

## Ambiente DEV (Agents Window / Cloud Agent)

- Fluxo: `feature/*` -> PR -> `dev` (Agents podem abrir/aprovar/mergear) -> PR -> `hml` / `main` (**só humano**).
- Na `feature/*` e no Cloud da missão: editar, testar, commit, push e PR/merge para `dev` **sem** pedir lote a cada passo (brief/pedido da missão já autoriza). Ver `__Confg-Projetos/AGENTS.md`.
- Branch **designada**: trabalhar **somente** na `feature/...` nomeada na missão / `NEXT-AGENT.md`. Se não existir, criar **apenas essa** a partir de `origin/dev`. **Proibido** criar outras branches. Sem nome no brief: pedir ao humano.
- **Proibido** para Agents: merge em `hml` ou `main`.
