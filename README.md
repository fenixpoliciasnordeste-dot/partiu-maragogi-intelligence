# PARTIU MARAGOGI INTELLIGENCE

Aplicação Next.js / TypeScript / App Router, Tailwind, Recharts, Prisma, PostgreSQL e SDK oficial `@google/genai`. A interface, as rotas e a persistência estão implementadas; não há dados de demonstração no produto.

**Situação da entrega:** código-fonte pronto para configuração e validação com contas reais. A coleta de perfis públicos do Instagram usa a Apify e depende de um token válido.

## Iniciar localmente

Requisitos: Node.js 22 ou 24; PostgreSQL 15+ com permissão para criar a extensão `pg_trgm`. Não há SQLite no runtime.

```bash
npm ci
cp .env.example .env
# Edite .env com os valores locais.
docker compose up -d
npm run db:deploy
npm run dev
```

Abra `http://localhost:3000`. Entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`. A senha deve ter pelo menos 16 caracteres. Para `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` e `SYNC_SECRET`, gere três valores independentes:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`TOKEN_ENCRYPTION_KEY` deve conter exatamente 64 caracteres hexadecimais. Guarde-a: alterar essa chave sem recriptografar os tokens exige reconectar as contas. O usuário administrador é criado no primeiro login válido. A V1 é um workspace privado, administrado por esse usuário; as preferências e os tutoriais têm vínculo com User. Não existe cadastro público.

## Estrutura

- `app/`: páginas Next.js e rotas HTTP protegidas.
- `components/`: dashboard, financeiro, pesquisa, gráficos, fontes, modais e tutoriais.
- `lib/providers/`: contrato `SocialDataProvider`, coleta Instagram via Apify, normalização e logs.
- `lib/sync.ts`: fila persistente, coleta, snapshots, classificações e análises.
- `lib/ai/`: schemas Zod/JSON Schema, prompts, cache, reservas de orçamento e AIService.
- `lib/search.ts`: full-text português, trigram e filtros parametrizados. A interface do serviço permite futura implementação vetorial sem refazer os consumidores.
- `prisma/`: schema, migração SQL e triggers de histórico imutável.
- `scripts/`: execução externa da fila e worker.
- `.github/workflows/`: CI e sincronização diária.

Os equivalentes de `CompetitorProfile`, `CompetitorSnapshot` e `CompetitorPost` são `SocialProfile`, `ProfileSnapshot` e `SocialPost` associados a `Competitor`. Assim, a coleta e os cálculos seguem o mesmo contrato, sem duplicar modelos de métricas. `PostSnapshot` guarda o histórico dos posts de ambas as origens.

## GitHub

Crie um repositório privado vazio e use a URL fornecida pelo GitHub:

```bash
git init -b main
git add .
git commit -m "Implement Partiu Maragogi Intelligence"
git remote add origin SUA_URL_DO_REPOSITORIO
git push -u origin main
```

Se a pasta já estiver versionada, pule `git init` e o commit inicial. `.env`, credenciais, dependências e arquivos de build são ignorados. O ZIP inclui `.env.example`, workflows e lockfile. Nunca inclua `.env` no commit.

## Render

1. Crie PostgreSQL no Render ou use uma instância PostgreSQL compatível e persistente. Selecione conscientemente o plano e a política de backups. O blueprint não provisiona banco pago implicitamente.
2. Conecte o repositório GitHub e crie um Blueprint usando `render.yaml` ou um Web Service Node.
3. Build: `npm ci --include=dev && npm run build`.
4. Start: `npm start` — executa `prisma migrate deploy` antes de iniciar o Next.js, sem depender de pre-deploy.
5. Configure `DATABASE_URL`, `APP_URL` (URL HTTPS exata, sem caminho), administrador, secrets e credenciais desejadas. No mesmo provedor/região, prefira a URL interna do banco. Garanta TLS para conexões externas conforme o provedor.
6. Após deploy, confira `/api/health`, login e Configurações → Integrações.
7. Copie `APP_URL` e `SYNC_SECRET` para os secrets do GitHub Actions. Habilite os workflows na branch padrão.

Planos gratuitos podem suspender por inatividade e não oferecem a mesma continuidade de um processo sempre ativo. A fila fica no PostgreSQL e a Action retoma a execução; nenhuma coleta retroativa é inventada se houver interrupções. Cron do GitHub pode atrasar. Para coleta com SLA, use plano adequado e worker/cron dedicado.

A aplicação permanece utilizável quando uma API não funciona. O banco é requisito para login, estado, logs e fila; falha do banco impede operações persistentes.

## Instagram via Apify

Configure `APIFY_TOKEN` e `INSTAGRAM_USERNAME`. A aplicação usa o Actor mantido pela Apify `apify/instagram-profile-scraper`, coletando o perfil público e até os 12 posts recentes em uma única execução por perfil.

`APIFY_DAILY_RUN_LIMIT` limita o total de perfis cobrados por dia. O padrão é 6: uma coleta do perfil principal e uma de cada um dos 5 concorrentes permitidos. O backend bloqueia novas execuções ao atingir o limite; a interface mostra o consumo diário. Perfis privados não disponibilizam publicações públicas.

O limite de concorrentes ativos é 5 e é aplicado no servidor. Excluir um concorrente libera uma vaga. Dados de alcance, salvamentos e outras métricas privadas permanecem indisponíveis; o sistema não os transforma em zero.

## Financeiro

A aba Financeiro registra receitas e gastos no PostgreSQL, calcula lucro e margem e exibe gráficos mensais de receitas, gastos, lucro e despesas por categoria. Os lançamentos podem ser incluídos e excluídos pelo administrador.

## Gemini

Configure `GEMINI_API_KEY` e `GEMINI_MODEL` com um modelo disponível no seu projeto e que aceite saída estruturada. Não se fixa um modelo supostamente gratuito ou uma tarifa antiga.

Em **Configurações → Limites**, informe tarifas por milhão de tokens, limites diário/mensal em USD e requisições. Inicialmente os limites são zero: nenhuma chamada automática é liberada antes da configuração. O teste de conexão também respeita o orçamento.

Todas as respostas usam `responseJsonSchema`, passam pela validação Zod e só então são persistidas. IDs de fontes desconhecidos fazem a resposta ser rejeitada. Captions são tratadas como conteúdo não confiável, nunca como instrução. O modelo recebe dados coletados, não substitui coleta e não assiste automaticamente ao vídeo.

Métodos: `analyzeProfile`, `analyzeCompetitor`, `compareProfiles`, `generateIdeas`, `generateScript`, `generateExecutionPrompt`, `classifyPost`, `detectContentPatterns`, `semanticSearch`, `generateInsightSources`. Prompts centralizados em `lib/ai/prompts.ts`.

Cache por hash do contexto, operação, modelo e versão do prompt. Abrir páginas não chama a IA. O botão de nova análise pode ignorar o cache, sempre respeitando os limites. Classificação tem hash por caption/formato/duração e processa apenas itens novos/alterados, até 50 por sincronização. As análises globais usam uma amostra de até 160 posts distribuída entre perfis relevantes; esse recorte é informado ao modelo. Não há reprocessamento obrigatório de todo o acervo.

Ideias retornam 10 itens por geração; títulos normalizados repetidos não criam duplicatas. Ideias e publicações anteriores são enviadas como contexto adicional para evitar repetição semântica, mas isso não é uma garantia matemática de originalidade. Roteiros/prompts ficam salvos; vincular uma ideia a um post real permite usar resultados em futuras gerações.

### Orçamento e estimativas

Antes da chamada, uma transação com advisory lock reserva uma estimativa conservadora usando bytes de entrada e limite de tokens de saída. Outras chamadas simultâneas consideram as reservas já existentes. Após a resposta, o uso informado pelo Gemini substitui a reserva. Se a rede falhar e o consumo não for conhecido, a reserva continua contabilizada, inclusive em logs com erro.

Nenhuma chamada manual contorna automaticamente os limites: o administrador deve alterá-los explicitamente. Alertas padrão: 50%, 75%, 90%, 100%. Custos são estimativas dependentes das tarifas configuradas; não são medição da fatura Google, impostos ou descontos. Se o provedor alterar preços, atualize as tarifas. A V1 não consulta faturas do Google Cloud.

## Semântica das métricas

- **DADO REAL DA API**: valor retornado e normalizado. `null` é indisponível; `0` é zero real.
- **DADO CALCULADO PELO SISTEMA**: crescimento, soma, média, percentil ou indicador derivado.
- **ESTIMATIVA OU INTERPRETAÇÃO DA IA**: posicionamento, avaliação, temas, recomendações e potencial.
- Crescimento necessita snapshot de referência antes da data alvo, com tolerância de até 2 dias; snapshot atual com mais de 2 dias é considerado desatualizado.
- Engajamento público comparável: `(curtidas + comentários) / seguidores na coleta × 100`. Compartilhamentos e salvamentos influenciam o score quando disponíveis, mas não são incluídos silenciosamente nessa taxa pública.
- Score 0–100: média de percentis das métricas disponíveis contra outras publicações do mesmo perfil; pelo menos 5 valores comparáveis por eixo. Empates recebem meio ponto de rank. Ausência não penaliza como zero. A audiência influencia via engajamento. É uma comparação com o acervo atual, não uma previsão nem uma métrica imutável da API.
- Melhor dia/hora: score médio com mínimo de 20/30 posts elegíveis e 3 no grupo; fuso `America/Maceio`. São associações observadas, sem garantia causal e sem correção por idade das publicações.
- Snapshots não são atualizados ou removidos; triggers impedem mutações. Exclusão de concorrente é arquivamento, preservando históricos.
- Confiança apresentada é **confiança da amostra**: alta com ≥30 posts, completude de curtidas/comentários ≥80%, intervalo ≥30 dias; média com ≥10, ≥60%, ≥7 dias; caso contrário baixa. A consistência de cada padrão precisa ser lida na evidência; essa regra não atesta a veracidade de toda frase gerada.
- Fontes guardam IDs reais dos posts e métricas usadas na análise. O painel mostra posts clicáveis e data de captura. Informação numérica produzida em texto pela IA ainda exige revisão; validação de schema/fontes não comprova todas as conclusões.

## Busca e filtros

Busca padrão PostgreSQL: full-text português, `pg_trgm`, caption e classificação; consulta parametrizada, sem SQL gerado pelo Gemini. Reconhece período, formato, origem, views e ordenação em consultas usuais. “Interpretar com Gemini” é opcional e explícito, contabilizado e limitado. Há filtros por plataforma, origem, perfil, formato, tema, funil, período, views, curtidas, comentários, engajamento, score e status via contrato.

Histórico e filtros salvos são por usuário. Filtros podem ser executados, editados, duplicados, renomeados e removidos. Busca inicial avalia até 1.000 posts e exibe até 200; limite é sinalizado e o usuário deve refinar filtros. O dashboard apresenta até 1.000 posts por perfil; todo o acervo continua persistido. Para grandes bases, adicionar paginação server-side dedicada é a evolução prevista.

## Automação e recuperação

`daily-social-sync.yml`: 09:17 UTC diariamente (06:17 em Alagoas), além de execução manual. `APP_URL` e `SYNC_SECRET` ficam em GitHub Actions Secrets.

- `POST /api/sync/cron`: enfileira perfis principais e concorrentes.
- `POST /api/sync/cron?drain=1`: processa um job por chamada.
- Autenticação: `Authorization: Bearer <SYNC_SECRET>`.
- A fila é PostgreSQL, com claim atômico (`FOR UPDATE SKIP LOCKED`) e deduplicação de destinos ativos.
- A UI enfileira e usa `after()` para iniciar processamento; consulta progresso sem reload completo.
- Um worker independente pode executar `npm run worker` para drenar a mesma fila.
- Jobs interrompidos há mais de 1h são marcados como erro antes de drenar; é possível solicitar uma nova coleta.
- Uma falha da IA não apaga os dados sociais coletados; aparece na descrição do job. Uma falha de uma plataforma não impede processar as outras.

Para alto volume, use worker persistente em vez de depender do ciclo de vida do Web Service gratuito. O provider atualmente busca todas as páginas autorizadas de posts em cada coleta, preservando snapshots dos posts antigos também; isso tem custo de requisições proporcional ao acervo. Classificação é incremental, coleta não é apenas de posts novos.

## Segurança

Sessão JWT assinada, cookie HttpOnly, SameSite=Lax e Secure em produção; expiração em 12h; autorização no servidor em todas as operações privadas. Login e APIs têm rate limiting PostgreSQL. Mutações exigem Origin igual a APP_URL; endpoint cron usa segredo independente. Secrets de aplicação ficam no ambiente. Comparação de credenciais/segredos usa hashes de tamanho fixo e comparação temporal segura. Logs não registram o token Apify.

Faça backup do PostgreSQL e da chave de criptografia. Não use banco de produção para testes destrutivos. As migrações da aplicação nunca fazem reset automático de banco. Dependências têm lockfile; revise atualizações de segurança antes de expor uma instalação por longo período.

## Verificação

```bash
npm test
npm run typecheck
npm run build
```

Os testes usam fixtures exclusivamente dentro dos testes, não no dashboard. Há teste da migração completa em PostgreSQL embarcado (PGlite com pg_trgm), full-text, locks de fila e proteção de snapshots; testes de métricas, ausência de dados, score, limites e criptografia. CI aplica a migração também em serviço PostgreSQL 16.

Após configurar contas reais: validar login, executar cada teste de conexão, coletar perfil e post, conferir métricas contra resposta oficial, revisar scopes, gerar uma análise, abrir fontes, gerar ideia/roteiro e acompanhar logs e orçamento. Essa validação externa não é substituída pelos testes locais.

## Documentação oficial usada

- Gemini: https://ai.google.dev/gemini-api/docs/structured-output
- Apify Actor API: https://docs.apify.com/api/v2/actors-actor-runs
- Instagram Profile Scraper: https://apify.com/apify/instagram-profile-scraper
- Render Next.js: https://render.com/docs/deploy-nextjs-app
- Render Blueprint: https://render.com/docs/blueprint-spec


Esse bundle não cria o repositório remoto por conta própria. A publicação no GitHub e no Render permanece pendente até conectar as respectivas contas.
