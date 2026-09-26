# Verificação da telemetria — HELLDIVERS-BR

Base: Helldivers-BR(6).zip enviado nesta conversa. Foram preservados todos os 46 arquivos originais; seis foram alterados. Este ZIP não contém as imagens, vídeos nem outros arquivos que já estavam ausentes do pacote enviado. Substitua os arquivos correspondentes no projeto existente; não apague suas pastas de mídia.

## Evidências

Endpoint consultado: https://api.helldivers2.dev/api/v1/campaigns
Duas respostas HTTP 200, com cabeçalhos Date de 26/09/2026 às 20:19:12 e 20:19:57 UTC (17:19:12 e 17:19:57 em São Paulo). ETags diferentes: 1790453931044 e 1790453981705.
As respostas completas estão nos dois JSONs desta pasta. São fotografias daquele intervalo, não dados atuais nem valores para incorporar ao site.

As 40 campanhas foram comparadas. Em 31 delas, health era igual a maxHealth nas duas leituras. Matar Bay, Luxuriant, Brilliance e Fronteria estão nesse grupo. Os seus jogadores mudaram, mas a barra planetária permaneceu em zero na fonte consultada. Não há prova de que o jogo inteiro esteja parado ou de que esses jogadores não tenham causado impacto.

A pressão desses quatro planetas é 1,25%/h, e não 12%. O código usa regenPerSecond × 3600 ÷ maxHealth × 100. Os valores não são fixados em 1,25: a API fornece números que produzem esse resultado.

Matar Bay: ISEGORIA passou de health 140710 para 140567, com maxHealth 200000. Isso equivale a 29,645% → 29,7165% de progresso regional. O planeta permaneceu em 0%. A região tinha 7785 → 7730 jogadores. Não somamos nem substituímos progresso regional por progresso planetário.

TERREK passou de health 955975 para 955779 (maxHealth 1000000); PANDION-XXIV passou de 558997 para 558708. Isso confirma mudanças na saúde de outros planetas na fonte consultada. Não extrapolamos esses 45 segundos para prometer um ritmo sustentado.

## Problemas encontrados e corrigidos

- “Impacto Helldiver / hora” era a diferença entre duas porcentagens planetárias, ou seja, avanço líquido. Agora o cartão e o dossiê mostram “Avanço líquido / hora”; em defesa, “Avanço da defesa / hora”. O impacto bruto não é inferido nem inventado.
- Em 0% planetário, há uma explicação curta. Quando há região disponível, a explicação aponta para Ver regiões, preservando o progresso independente.
- Saúde, máximo ou quantidade de jogadores ausentes não são apresentados como zero confirmado nos cartões/dossiês da Central de Guerra. Progresso inválido não gera amostra nem previsão.
- Regeneração negativa existia na resposta real de PANDION-XXIV (-2,7777777 HP/s, aproximadamente -1%/h). A Central a descartava; os dois scripts de mapa a transformavam em zero. Agora o sinal é preservado; dado de regeneração ausente aparece indisponível.
- Taxas antigas não são usadas quando a telemetria está marcada como desatualizada. A troca do ID da campanha reinicia o histórico para evitar comparar campanhas distintas no mesmo planeta.

Não foi implementado um cálculo de impacto bruto por número de jogadores. A população, sozinha, não permite obtê-lo. A ausência de avanço líquido no piso de 0% também não permite recuperá-lo pela soma automática com a regeneração.

## Arquivos alterados

- guerra.js: correções dos indicadores, dados ausentes, histórico e notas.
- guerra.html e ordem.html: atualização da referência de versão de guerra.js.
- mapa-classico.js e mapa.js: preservação de regeneração negativa e estado ausente. mapa.js é um script legado presente no pacote; mapa-galatico.html usa um mapa incorporado externo, não esse script.
- mapa-classico.html: atualização da referência de versão do script.

Demais arquivos originais preservados byte a byte. Nenhum deploy foi realizado.

## Validação e limites

Todos os JavaScripts do pacote passaram em node --check. Testes de execução cobriram progresso ausente/inválido, zero confirmado, avanço, cache repetido, falha da fonte, nova campanha, regeneração negativa, previsão e relógio de defesa. Foi validada a geração de HTML dos 40 cartões reais, mais casos explicitamente simulados de dados ausentes e defesa. Os testes não fornecem dados para o site.

A validação visual em navegador não foi concluída: o ambiente estava sem Chromium e o download do navegador falhou. Não afirmamos validação visual de desktop/celular nem paridade de valores com a tela do jogo. A API consultada é comunitária; uma falha a montante ou diferença em relação ao jogo não pode ser descartada por essas duas respostas.

Execute `node auditoria-telemetria/verificar.cjs` na raiz do pacote para repetir os testes locais. As capturas em JSON servem apenas de evidência; o site continua consultando a API.

## Comparação de todas as campanhas

Os percentuais abaixo são calculados a partir das respostas anexas, arredondados a quatro casas. Jogadores e regeneração são da segunda resposta.

| Planeta | Jogadores | Progresso 1 | Progresso 2 | Regeneração (%/h) |
|---|---:|---:|---:|---:|
| ZEA RUGOSIA | 83 | 0.0000% | 0.0000% | 2.941176 |
| OMICRON | 2919 | 0.0000% | 0.0000% | 3.333333 |
| CHARON PRIME | 1987 | 0.0000% | 0.0000% | 3.500000 |
| VALMOX | 324 | 0.0000% | 0.0000% | 0.526316 |
| HALDUS | 59 | 0.0000% | 0.0000% | 1.500000 |
| AURORA BAY | 1405 | 0.0000% | 0.0000% | 3.125000 |
| MERGA IV | 714 | 0.0000% | 0.0000% | 7.000000 |
| HESOE PRIME | 123 | 0.0000% | 0.0000% | 4.000000 |
| SIEMNOT | 1451 | 0.0000% | 0.0000% | 1.000000 |
| GRAFMERE | 1106 | 0.0000% | 0.0000% | 0.476190 |
| CHOOHE | 1408 | 0.0000% | 0.0000% | 2.500000 |
| RD-4 | 252 | 0.0000% | 0.0000% | 1.000000 |
| BLISTICA | 221 | 0.0000% | 0.0000% | 2.500000 |
| PANDION-XXIV | 9021 | 44.1003% | 44.1292% | -1.000000 |
| ROGUE 5 | 62 | 0.0000% | 0.0000% | 1.000000 |
| SENGE 23 | 675 | 0.0000% | 0.0000% | 1.538461 |
| ALARAPH | 5758 | 24.2367% | 24.2373% | 0.000056 |
| GENESIS PRIME | 721 | 6.7206% | 6.7207% | 0.000000 |
| ASPEROTH PRIME | 414 | 3.5121% | 3.5121% | 0.000056 |
| HEZE BAY | 147 | 2.3433% | 2.3433% | 0.000056 |
| HERTHON SECUNDUS | 48 | 1.0215% | 1.0215% | 0.000056 |
| NEW STOCKHOLM | 591 | 12.1811% | 12.1811% | 0.000100 |
| BRILLIANCE | 4659 | 0.0000% | 0.0000% | 1.250000 |
| PARTION | 2021 | 0.0000% | 0.0000% | 1.500000 |
| TRANDOR | 1091 | 0.0000% | 0.0000% | 1.052632 |
| HEETH | 6137 | 0.0000% | 0.0000% | 2.000000 |
| CHOEPESSA IV | 2255 | 0.0000% | 0.0000% | 0.468750 |
| ZZANIAH PRIME | 1752 | 0.0000% | 0.0000% | 1.500000 |
| K | 371 | 0.0000% | 0.0000% | 1.250000 |
| TERREK | 23298 | 4.4025% | 4.4221% | 1.000000 |
| LUXURIANT | 9807 | 0.0000% | 0.0000% | 1.250000 |
| HYDROBIUS | 211 | 1.2449% | 1.2449% | 0.000071 |
| SANGIS | 357 | 0.0000% | 0.0000% | 1.000000 |
| KEID | 326 | 0.0000% | 0.0000% | 1.000000 |
| FURY | 500 | 0.0000% | 0.0000% | 1.000000 |
| KHANDARK | 117 | 0.0000% | 0.0000% | 1.000000 |
| FRONTERIA | 3469 | 0.0000% | 0.0000% | 1.250000 |
| MEISSA | 2802 | 0.0000% | 0.0000% | 4.500000 |
| MARTALE | 3406 | 0.0000% | 0.0000% | 1.000000 |
| MATAR BAY | 19090 | 0.0000% | 0.0000% | 1.250000 |
