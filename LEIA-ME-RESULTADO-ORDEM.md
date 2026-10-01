# Correção do resultado da Ordem Maior — site e app

## Causa reproduzida
A ordem 1715805482 usa o título genérico MAJOR ORDER e objetivos de eliminar inimigos, sem IDs de planetas. O despacho 3942 anuncia explicitamente MAJOR ORDER FAILED, mas a regra antiga o rejeitava por não conter assignmentId, planetas-alvo ou um título específico. O snapshot continuava active e, após o prazo, as interfaces exibiam aguardando confirmação.

## Correção
- Mantidos os vínculos existentes por ID, planeta e título específico.
- Para ordens genéricas sem planetas-alvo, exige anúncio explícito de vitória/derrota, data próxima ao prazo da ordem e contexto textual forte: pelo menos quatro palavras relevantes compartilhadas e dois pares de palavras compartilhados. Plurais simples são normalizados.
- Descartados anúncios anteriores à primeira leitura, futuros, de IDs diferentes, sem contexto suficiente ou separados por anúncio de nova ordem próximo ao encerramento.
- Expiração, ausência da API e progresso incompleto não confirmam derrota sozinhos.
- A mesma regra está no order-state.js e no atualizador Python do JSON compartilhado.
- O JSON incluído já foi confirmado pelo próprio atualizador consultando a API: estado failed, fonte dispatch e evidência do despacho 3942. Mantém os contadores realmente registrados; não inventa uma medição final. O percentual conservado é o da última medição disponível.
- As páginas Início, Guerra e Ordem usam uma versão nova da URL de order-state.js para carregar a correção.
- O workflow executa os testes antes de atualizar o snapshot.

## Onde colocar
ESTE PATCH VAI NO REPOSITÓRIO DO SITE HELLDIVERS-BR, não no repositório HELLDIVERS-BR-App e não no R2.

1. Faça backup dos arquivos correspondentes no site.
2. Extraia este ZIP e copie o conteúdo da pasta Helldivers-BR-Correcao-Ordem para a raiz do repositório do SITE, mantendo .github/scripts, .github/workflows e dados nas mesmas posições.
3. Envie os arquivos alterados e novos ao GitHub, incluindo os testes e o fixture.
4. Faça o deploy do site no Cloudflare Pages para publicar a correção das páginas.
5. No GitHub do SITE, abra Actions → Atualizar Ordem Maior → Run workflow. O agendamento existente de dez minutos foi preservado; o GitHub pode atrasar execuções agendadas.
6. Reabra/atualize o site. No app, use atualizar telemetria ou aguarde a atualização normal. O app consulta dados/major-order.json nesse mesmo repositório e já sabe exibir failed: não precisa gerar outro APK para esta correção.

O JSON está ligado a esta ordem por ID. Uma nova ordem ativa continua tendo prioridade e não herda a derrota anterior. Se uma nova ordem já estiver disponível quando você aplicar o patch, execute o workflow para atualizar imediatamente o snapshot.

## Validação
- Reproduzido com os dados reais: regra antiga retornou nenhum resultado; regra corrigida retornou failed.
- 11 testes Python e 14 verificações JavaScript passaram, incluindo a conservação do resultado quando chega snapshot antigo e a prioridade de uma ordem nova.
- order-state.js validado pelo parser do Node.
- Atualizador executado localmente com a API real, gerando o JSON de resultado incluído.
- Nenhuma publicação remota ou alteração no APK foi realizada nesta entrega.
