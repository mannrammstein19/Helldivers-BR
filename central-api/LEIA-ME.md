# Central de telemetria HELLDIVERS-BR — teste inicial no site

A central está pronta para publicar, mas ainda não foi publicada na sua conta.
O app não foi alterado. O site funciona sem a central enquanto `centralUrl` estiver vazio.

## O que mudou agora no site

- Início, Guerra, Ordem e Mapa Clássico passam pelo mesmo cliente de telemetria.
- Sem central: consultas à Community entram numa fila, espaçadas por 2,6 segundos. O prazo passa de 8 para 15 segundos, incluindo leitura do JSON. A coalescência evita consultas repetidas na mesma aba.
- Cache com data verdadeira, validação de resposta e recuperação após falhas.
- Erros mostram origem, caminho, duração e status HTTP no console, incluindo timeout e 429.
- Ao retornar à aba ou apertar atualizar, a espera do servidor continua sendo respeitada.
- Ativar a central não muda as imagens, a geometria do mapa ou a lógica do resultado da Ordem.

## O que a central faz

Um Worker da Cloudflare envia todos os visitantes para um único Durable Object com armazenamento persistente. O R2 continua sendo usado para seus APKs e imagens; não executa esta central.

| Informação | Fonte principal | Recuperação | Intervalo mínimo do recurso |
| --- | --- | --- | --- |
| Estado dos planetas, jogadores, campanhas e regiões | API do jogo | Community e última leitura válida | 60 segundos |
| Ordem Maior ativa | API do jogo | Community e última leitura válida | 60 segundos |
| Despachos | Community | Última leitura válida | 120 segundos |
| DSS e ações | Community | Última leitura válida | 60 segundos |
| Notícias Steam | API Steam | Community e última leitura válida | 15 minutos |

Catálogo descritivo (nomes, biomas, ícones) e estatísticas históricas complementam o estado bruto a partir da Community, com cache de 5 minutos. As estatísticas têm data própria no dossiê do Mapa. A central não inventa contadores nem dados ausentes. O catálogo precisa de uma primeira leitura válida para montar a resposta rica; se não conseguir, usa a recuperação do recurso.

Despachos permaneceram na Community porque a consulta bruta testada retornou 1.024 mensagens antigas e truncou as recentes. A DSS mantém seu esquema rico de ações. A migração dessas duas fontes exige validar seus endpoints antes; não declaramos leitura bruta incompleta como uma leitura completa.

O estado bruto da região é associado por planeta + regionIndex + hash. Saúde regional não altera saúde planetária. Se uma leitura regional já confirmada ficar indisponível, seu último estado conhecido pode continuar com marca de dado salvo e data original. Um hash novo não herda o estado de outra região.

Um refresh por visitante não força novas consultas ao jogo. Há cache, coalescência, fila comum das consultas externas, espera de 429 independente por origem e espera após falhas. Os intervalos são escolhas conservadoras para o teste; não representam uma cota autorizada pela Arrowhead.

## 1. Aplicar o patch do site

Copie os arquivos do patch por cima do projeto mais recente, mantendo suas pastas de imagens e os arquivos não incluídos. Faça o deploy habitual do site. Com `telemetry-config.js` vazio, já entram as melhorias do cliente, mas a Community continua como fonte.

O patch contém a pasta nova `central-api`. Ela pode ser guardada no mesmo repositório. Os workflows existentes da Ordem não precisam ser substituídos; não foram fornecidos neste ZIP e não foram editados.

## 2. Publicar a central, separadamente do site

No PC, com Node.js disponível, abra um terminal dentro da pasta `central-api`:

```sh
npm ci
npm test
npm run check
npx wrangler login
npm run deploy
```

`login` abre a autorização da sua conta Cloudflare. Não coloque chaves dentro do site ou deste arquivo. `deploy` cria/publica o Worker com o binding e a migração do Durable Object já declarados em `wrangler.jsonc`.

O comando mostra a URL real terminada em `workers.dev`. Use essa URL; não existe uma URL criada antecipadamente neste pacote.

O nome sugerido é `helldivers-br-central`. Verifique antes se você já tem um Worker com esse nome: se tiver, use um nome novo no campo `name` para manter o teste separado.

Origens permitidas no arquivo: `https://helldivers-br.pages.dev`, `https://mannrammstein19.github.io`, e localhost na porta 8000. Se você acessa por domínio próprio, acrescente a origem exata em `ALLOWED_ORIGINS` antes de publicar. Caminho como `/Helldivers-BR/` não pertence à origem.

## 3. Conferir antes de conectar o site

Abra a URL publicada com `/health` no final: deve aparecer o nome do serviço.
Depois abra `/api/v1/planets` e `/api/v1/campaigns`.

A resposta da central contém `data`, `time`, `source`, `stale`, `next`. Em caso de erro, aparece status 503 e uma explicação. A primeira coleta pode demorar mais por ainda não haver cache; leituras seguintes compartilham o estado salvo. `/diagnostics` mostra os horários, fontes e falhas por recurso, sem credenciais.

Os dados são públicos. CORS restringe origens de navegador; não é uma autenticação nem torna dados privados.

## 4. Ativar no site

Edite apenas `telemetry-config.js`, na raiz:

```js
window.HDBRTelemetryConfig = Object.freeze({
  centralUrl: 'COLE_AQUI_A_URL_HTTPS_REAL_DO_WORKER',
  timeoutMs: 45000,
  directTimeoutMs: 15000
});
```

Não acrescente `/api` ao final. Suba esse arquivo no GitHub e faça o deploy habitual. Recarregue a página.

Início, Guerra, Ordem e Mapa Clássico passam a usar a central. O mapa incorporado de hd2galaxy.com é um serviço externo e mantém sua própria telemetria. O `mapa.js` antigo, que não é carregado pelos HTML fornecidos, não foi alterado.

A aba Console do navegador aceita:

```js
HDBRWarData.centralEnabled
HDBRWarData.diagnostics()
```

Com a central ativa, uma falha não dispara consultas diretas de cada visitante aos servidores externos. A recuperação acontece na central; o navegador também preserva o cache local.

## 5. Testar e voltar atrás

- Abra em dois aparelhos e confira origem/horários equivalentes.
- Confirme planetas, campanhas, Ordem, despachos, DSS e Steam.
- Confirme saúde/progresso do planeta separados de cada região.
- Desconecte a rede após uma primeira leitura válida: a última leitura deve ficar marcada como salva, sem alterar o horário.
- Reconecte e aguarde a nova coleta.
- Para interromper o teste, deixe `centralUrl: ''` e publique esse arquivo novamente. O site volta à Community com o cliente melhorado.

## Validação feita neste pacote

- Testes automatizados do cliente, adaptadores, cache, concorrência, reinício, 429, timeout real, origem CORS e identidade regional.
- Teste dos adaptadores com respostas reais: 273 planetas, 38 campanhas e 211 regiões no conjunto recebido.
- Compilação do Worker com Wrangler em dry-run, sem publicar.
- Verificação de sintaxe dos JavaScript da raiz.

A publicação em Cloudflare e o comportamento no seu navegador ainda precisam ser conferidos após o deploy. A execução local completa do Worker foi bloqueada pelo ambiente de rede do executor; não foi declarada como teste de produção. As pastas de imagens não foram fornecidas e foram consideradas existentes conforme sua instrução.

Referências: https://github.com/helldivers-2/api ; https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/ ; https://developers.cloudflare.com/durable-objects/platform/limits/
