# Entrega e validação

Código real implementado para Partiu Maragogi Intelligence. Nenhuma credencial real e nenhuma métrica de demonstração estão incluídas.

## Implementado

- Next.js 15, React 19, TypeScript, Tailwind, Recharts e área financeira.
- PostgreSQL, Prisma, migração completa, busca full-text e trigram, snapshots imutáveis.
- Login administrativo, sessão, validações, Origin, rate limiting, criptografia de tokens.
- Coleta de perfil próprio e até 5 concorrentes públicos do Instagram pela Apify, com limite diário de custo.
- Fila persistente, progresso, atualização manual, automação GitHub e worker.
- Gemini estruturado, cache, classificação incremental, evidências, geração de ideias/roteiros/prompts.
- Filtros salvos, histórico de busca, classificação de conteúdo, histórico de análises.
- Custos, reservas, limites, alertas, logs e tutoriais que destacam elementos reais.
- README, variáveis de exemplo, Docker Compose para PostgreSQL, Render Blueprint e workflows.

## Verificado nesta entrega

- Compilação de produção e checagem TypeScript.
- 7 testes: migração PostgreSQL embarcada, full-text, fila, imutabilidade de snapshots, métricas ausentes, score, crescimento, confiança/velocidade, limites e criptografia (alguns cenários agrupados no mesmo teste).
- Fixtures usadas apenas dentro dos testes; não inseridas em banco de usuário.

## Ainda depende de ambiente externo

- Criação/push do repositório GitHub.
- Provisionamento do banco de produção e deploy no Render.
- Configuração do token Apify, perfil principal e limites de consumo.
- Modelo, chave e tarifas Gemini.
- Testes ponta a ponta com contas reais e validação visual no navegador.

## Limites da implementação inicial

- Workspace com um administrador configurado no ambiente.
- Dashboard até 1.000 posts por perfil; busca exibe até 200 resultados entre até 1.000 candidatos.
- Gemini usa até 160 posts por análise e classifica até 50 posts novos/alterados por sync.
- Confiança mede cobertura da amostra, não certifica a conclusão semântica.
- Custos dependem das tarifas configuradas; não são fatura oficial.
- Métricas privadas de concorrentes não são recuperadas por métodos alternativos.
- A Apify coleta apenas os dados publicamente disponíveis e retorna até 12 posts recentes por perfil neste fluxo econômico.
- A atualização diária depende de GitHub Actions ativo e disponibilidade do serviço e das APIs.

As limitações estão visíveis ou documentadas. O sistema não afirma que integrações ainda não configuradas estão operacionais.
