# Backlog Tecnico Priorizado

Backlog tecnico sugerido para evolucao do projeto `VCA Distribuidor`, com foco em seguranca, confiabilidade operacional, manutenibilidade e produtividade de entrega.

## Como Executar

Recomendacao: trabalhar este backlog em **multiplas branches**, e nao em uma branch unica de longa duracao.

Motivo:

- reduz risco de merge grande e regressao;
- facilita review por tema;
- permite deploy gradual;
- isola mudancas de alto risco, especialmente auth, sync e schema.

Branch atual de planejamento:

- `docs/backlog-tecnico-priorizado`

Estrategia sugerida de execucao:

- 1 branch por ticket quando o ticket for autocontido;
- 1 branch por epico quando os tickets forem pequenos e fortemente acoplados;
- merge em `main` apenas apos validacao funcional e tecnica.

## Escala de Esforco

- `P0`: critico, deve entrar primeiro
- `P1`: alto impacto, deve entrar logo apos P0
- `P2`: importante, mas pode vir em seguida
- `P3`: melhoria incremental

- `S`: ate 1 dia util
- `M`: 2 a 4 dias uteis
- `L`: 5 a 8 dias uteis
- `XL`: 9+ dias uteis

## Ordem Recomendada

1. Blindar exposicao de dados e padronizar respostas sensiveis.
2. Versionar schema faltante e criar base minima de testes.
3. Separar o sync do processo web e reduzir round-trips com Supabase.
4. Modularizar backend.
5. Modularizar frontend e padronizar camada HTTP.
6. Remover modos legados e elevar observabilidade.

## Epicos

### EPICO 1 - Seguranca e Contratos de API

Objetivo:

- impedir exposicao indevida de dados;
- endurecer autenticacao/autorizacao;
- padronizar payloads de resposta.

#### TKT-001 - Blindar retorno de login e listagens sensiveis

- Prioridade: `P0`
- Esforco: `M`
- Branch sugerida: `fix/api-hide-sensitive-fields`
- Objetivo: impedir retorno de campos internos como hash de senha, session metadata irrelevante e colunas desnecessarias.
- Escopo:
- revisar endpoints de login de analista e admin;
- revisar listagem de analistas e admins;
- substituir `select("*")` por colunas explicitas;
- criar `response_model` ou serializer dedicado para cada resposta exposta.
- Criterios de aceite:
- nenhum endpoint publico ou autenticado retorna campo `senha`;
- listagens retornam apenas colunas usadas pela UI;
- login continua funcional para analista e gestor;
- diferenca de payload documentada.
- Dependencias: nenhuma.

#### TKT-002 - Exigir autenticacao e perfil correto nas rotas administrativas e operacionais

- Prioridade: `P0`
- Esforco: `S`
- Branch sugerida: `fix/auth-guard-endpoints`
- Objetivo: remover acessos permissivos ou inconsistentes nas rotas.
- Escopo:
- revisar rotas sem `require_manager_auth` ou `require_analyst_auth`;
- revisar coerencia entre `analista_id` da rota e token;
- revisar cenarios de leitura global.
- Criterios de aceite:
- endpoints de leitura operacional nao ficam acessiveis sem token;
- tentativas indevidas retornam `401` ou `403` corretamente;
- frontend continua operando com sessao valida.
- Dependencias: nenhuma.

#### TKT-003 - Padronizar DTOs e contratos de request/response

- Prioridade: `P1`
- Esforco: `M`
- Branch sugerida: `refactor/api-dtos-and-contracts`
- Objetivo: reduzir acoplamento entre modelo de banco e payload HTTP.
- Escopo:
- criar schemas de entrada e saida por dominio;
- padronizar mensagens de erro principais;
- remover `dict(modelo_banco)` como resposta direta.
- Criterios de aceite:
- rotas principais possuem schemas de resposta declarados;
- payloads ficam estaveis e previsiveis;
- nao existe retorno cru do Supabase para cliente.
- Dependencias: `TKT-001`.

### EPICO 2 - Banco, Migrations e Qualidade

Objetivo:

- tornar o ambiente reproduzivel;
- reduzir risco de drift entre codigo e banco;
- criar rede minima de seguranca para evolucao.

#### TKT-004 - Versionar schema da tabela `distribuicoes`

- Prioridade: `P0`
- Esforco: `S`
- Branch sugerida: `chore/db-add-distribuicoes-migration`
- Objetivo: eliminar dependencia de schema manual nao versionado.
- Escopo:
- adicionar migration de criacao ou documentacao idempotente de `distribuicoes`;
- incluir indices e constraints esperadas;
- atualizar documentacao de bootstrap.
- Criterios de aceite:
- repositorio permite reconstruir o schema conhecido sem etapa manual oculta;
- `README` e docs refletem a origem da tabela;
- campos usados pelo backend estao explicitados.
- Dependencias: nenhuma.

#### TKT-005 - Criar suite minima de testes do backend

- Prioridade: `P0`
- Esforco: `L`
- Branch sugerida: `test/backend-core-flows`
- Objetivo: cobrir fluxos de maior risco com testes automatizados.
- Escopo:
- configurar `pytest`;
- adicionar testes para login, auth, alteracao de senha, distribuicao, redistribuicao e transferencia;
- mockar Supabase e integracao CVCRM quando necessario.
- Criterios de aceite:
- pipeline local executa testes com um comando unico;
- cenarios de auth e distribuicao possuem cobertura basica;
- regressao de payload sensivel eh detectavel.
- Dependencias: `TKT-001`, `TKT-002`, `TKT-004`.

#### TKT-006 - Criar suite minima de testes do frontend

- Prioridade: `P1`
- Esforco: `M`
- Branch sugerida: `test/frontend-critical-flows`
- Objetivo: proteger fluxos essenciais da interface.
- Escopo:
- configurar `Vitest` e React Testing Library;
- testar login, logout, render de tabs, erros de auth e acoes principais de mesa.
- Criterios de aceite:
- existe comando de teste no `package.json`;
- pelo menos fluxos criticos de login e render principal estao cobertos;
- falhas de contrato basico de API quebram teste.
- Dependencias: `TKT-003`.

### EPICO 3 - Sincronizacao e Confiabilidade Operacional

Objetivo:

- evitar execucao duplicada;
- melhorar throughput do sync;
- reduzir custo de manutencao operacional.

#### TKT-007 - Extrair worker de sincronizacao do processo web

- Prioridade: `P0`
- Esforco: `L`
- Branch sugerida: `refactor/sync-worker-separation`
- Objetivo: impedir multiplos loops de sync por instancia web e preparar operacao mais previsivel.
- Escopo:
- mover `background_task` para um worker/comando dedicado;
- permitir execucao por cron, job ou processo separado;
- manter endpoint de status consumindo estado persistido ou cache controlado.
- Criterios de aceite:
- backend web sobe sem iniciar loop infinito de sync por padrao;
- sync pode ser executado de forma controlada;
- documentacao operacional atualizada.
- Dependencias: `TKT-004`.

#### TKT-008 - Otimizar sync para reduzir round-trips no Supabase

- Prioridade: `P1`
- Esforco: `L`
- Branch sugerida: `perf/sync-batch-operations`
- Objetivo: reduzir custo por reserva e melhorar tempo de ciclo.
- Escopo:
- buscar distribuicoes locais em lote;
- mapear analistas e permissoes em memoria;
- agrupar `upserts`, `updates` e limpeza;
- evitar `select("*")` por item.
- Criterios de aceite:
- numero de chamadas por ciclo cai perceptivelmente;
- duracao media do sync melhora;
- comportamento funcional permanece igual.
- Dependencias: `TKT-007`.

#### TKT-009 - Persistir auditoria de execucao do sync

- Prioridade: `P2`
- Esforco: `M`
- Branch sugerida: `feat/sync-audit-trail`
- Objetivo: permitir diagnostico sem depender apenas de memoria ou logs soltos.
- Escopo:
- registrar inicio, fim, duracao, falhas e volume por situacao;
- armazenar historico basico em tabela propria ou log estruturado externo.
- Criterios de aceite:
- gestor ou operacao consegue consultar ultimas execucoes;
- falhas ficam rastreaveis com contexto suficiente.
- Dependencias: `TKT-007`.

### EPICO 4 - Refactor de Backend

Objetivo:

- diminuir acoplamento;
- facilitar manutencao e teste;
- permitir evolucao de features com menos regressao.

#### TKT-010 - Quebrar `backend/main.py` por dominio

- Prioridade: `P1`
- Esforco: `XL`
- Branch sugerida: `refactor/backend-modularization`
- Objetivo: separar responsabilidades hoje concentradas em um unico arquivo.
- Escopo:
- criar modulos `routers`, `services`, `schemas`, `repositories`, `core`;
- mover auth, sync, analytics e operacoes de fila para modulos separados;
- manter rotas e comportamento atuais.
- Criterios de aceite:
- `main.py` vira ponto de montagem da aplicacao;
- responsabilidades ficam distribuídas por dominio;
- suite de testes continua passando.
- Dependencias: `TKT-003`, `TKT-005`.

#### TKT-011 - Criar camada de configuracao e logging estruturado

- Prioridade: `P1`
- Esforco: `M`
- Branch sugerida: `refactor/backend-settings-and-logging`
- Objetivo: substituir configuracao dispersa e `print` por estrutura mais profissional.
- Escopo:
- centralizar env vars em modulo de settings;
- trocar `print` por `logging`;
- definir formato consistente para eventos relevantes.
- Criterios de aceite:
- configuracao obrigatoria e default ficam centralizados;
- logs principais saem com contexto e nivel adequado.
- Dependencias: `TKT-010` pode rodar junto ou depois.

### EPICO 5 - Refactor de Frontend

Objetivo:

- reduzir complexidade do `App.jsx`;
- isolar estado por contexto funcional;
- melhorar manutencao e testabilidade.

#### TKT-012 - Extrair estado e fluxos de auth

- Prioridade: `P1`
- Esforco: `M`
- Branch sugerida: `refactor/frontend-auth-state`
- Objetivo: remover de `App.jsx` a gestao direta de sessoes e login.
- Escopo:
- criar hook ou contexto para sessao de analista e gestor;
- centralizar persistencia em `sessionStorage`;
- encapsular logout por expiracao/unauthorized.
- Criterios de aceite:
- `App.jsx` deixa de coordenar auth em detalhe;
- login e logout continuam com mesmo comportamento funcional.
- Dependencias: `TKT-003`.

#### TKT-013 - Padronizar client HTTP e tratamento de erro

- Prioridade: `P1`
- Esforco: `M`
- Branch sugerida: `refactor/frontend-api-client`
- Objetivo: reduzir repeticao de `res.ok`, `401`, parse e fallback espalhado.
- Escopo:
- criar camada de requisicao com parse padronizado;
- unificar interceptacao de unauthorized;
- consolidar fallback de rotas em um ponto unico.
- Criterios de aceite:
- componentes consomem funcoes orientadas a dados, nao `Response` cru;
- erros comuns ficam padronizados.
- Dependencias: `TKT-003`.

#### TKT-014 - Quebrar `App.jsx` por feature

- Prioridade: `P2`
- Esforco: `L`
- Branch sugerida: `refactor/frontend-app-shell`
- Objetivo: reduzir a concentracao de estado, efeitos e acoes em um unico arquivo.
- Escopo:
- separar shell da aplicacao;
- mover dados de manager, mesa, analytics e modais para hooks/componentes de dominio;
- preservar layout atual.
- Criterios de aceite:
- `App.jsx` vira orquestrador fino;
- principais efeitos e handlers saem do arquivo principal.
- Dependencias: `TKT-012`, `TKT-013`, `TKT-006`.

### EPICO 6 - Remocao de Legado e Operacao

Objetivo:

- reduzir complexidade acidental;
- remover caminhos temporarios que podem virar problema permanente.

#### TKT-015 - Remover modo legado de admin e fallbacks obsoletos

- Prioridade: `P2`
- Esforco: `S`
- Branch sugerida: `chore/remove-legacy-admin-mode`
- Objetivo: encerrar compatibilidades temporarias apos consolidacao do backend atual.
- Escopo:
- remover `LEGACY_MANAGER_TOKEN`;
- remover fallback de rotas antigas nao mais suportadas;
- ajustar mensagens e docs.
- Criterios de aceite:
- frontend opera apenas com contratos suportados;
- nao ha caminho de acesso admin artificial.
- Dependencias: `TKT-013`.

#### TKT-016 - Adicionar pipeline de qualidade minima

- Prioridade: `P2`
- Esforco: `M`
- Branch sugerida: `ci/add-quality-pipeline`
- Objetivo: evitar regressao basica antes de merge.
- Escopo:
- adicionar comandos padrao de teste e build;
- criar fluxo CI para backend e frontend;
- falhar PR em erro de teste ou build.
- Criterios de aceite:
- existe pipeline automatizada valida;
- merge deixa de depender so de verificacao manual.
- Dependencias: `TKT-005`, `TKT-006`.

## Entregas Recomendadas por Fase

### Fase 1 - Risco Imediato

- `TKT-001`
- `TKT-002`
- `TKT-004`

### Fase 2 - Base de Seguranca e Qualidade

- `TKT-003`
- `TKT-005`
- `TKT-006`

### Fase 3 - Confiabilidade do Core

- `TKT-007`
- `TKT-008`
- `TKT-009`

### Fase 4 - Refactor Estrutural

- `TKT-010`
- `TKT-011`
- `TKT-012`
- `TKT-013`
- `TKT-014`

### Fase 5 - Fechamento de Divida Tecnica

- `TKT-015`
- `TKT-016`

## Recomendacao Final de Branching

Para este projeto, a melhor abordagem e:

- usar **uma branch de documentacao** para planejar;
- usar **branches separadas por ticket/epico** para executar;
- evitar acumular `P0` e refactors grandes na mesma branch;
- tratar `auth`, `schema`, `sync` e `frontend shell` como frentes independentes.

Sequencia pratica sugerida de branches:

1. `fix/api-hide-sensitive-fields`
2. `fix/auth-guard-endpoints`
3. `chore/db-add-distribuicoes-migration`
4. `test/backend-core-flows`
5. `refactor/sync-worker-separation`
6. `perf/sync-batch-operations`
7. `refactor/backend-modularization`
8. `refactor/frontend-auth-state`
9. `refactor/frontend-api-client`
10. `refactor/frontend-app-shell`

Se a equipe for pequena, agrupar por epico faz sentido. Se houver mais de uma frente paralela, trabalhar por ticket reduz conflito e aumenta previsibilidade.
