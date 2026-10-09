# AGENTS.md — league-of-legends-spell-timer

Instruções para agentes neste repositório de código.

## Ordem de leitura (obrigatória)

1. Meta-repo `__Confg-Projetos`: `PRIORIDADE.md` e `WIP.md`.
2. Pasta do projeto: `d:/Docs Locais/Git/__Confg-Projetos/projetos/11-league-of-legends-spell-timer/` — ler `AGENTS.md`, `SPEC.md`, `MVP.md`, `ROADMAP.md` (e demais docs conforme a tarefa) **antes** de editar código aqui.
3. Só então este repo (`league-of-legends-spell-timer`).

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

- Projeto **lateral** (fora do ranking 1–10 / não é Slot A): overlay de PC para timers de summoner spells inimigas no LoL.
- Não é companion mobile; overlay desktop always-on-top sem roubar cliques/foco do jogo.
- Sem injection/leitura ilegal do cliente; Riot API Key fica local (UI / perfil) — não commitar secrets.
