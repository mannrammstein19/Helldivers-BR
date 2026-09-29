# Aplicativos no portal

Base: Helldivers-BR(8).zip enviado nesta conversa. Pacote completo dos arquivos leves recebidos, com as adições abaixo. As pastas pesadas não foram incluídas nem removidas.

- index.html: chamada após a Ordem Maior mobile, antes do Discord. Visível também no desktop.
- aplicativos.html/css/js: apresentação Portal e Companion, responsiva, seguindo paleta e cantos arredondados.
- theme.js: entrada Aplicativos Android no menu das páginas que já carregam esse script.
- aplicativos-downloads.json: configuração separada dos downloads.
- Contadores HTML de guerra, dossiê, regiões e mapa usam imagens/ui/icons/helldiver.png. Alguns contadores do index já usavam esse arquivo.

## Publicar

Copie os arquivos do ZIP para a raiz do site, substituindo os existentes. Preserve GitHub Actions, dados, imagens, scripts e demais pastas ausentes deste pacote leve. Não apague seu repositório para substituir pela pasta deste ZIP.

## Ativar downloads

Os dois links estão vazios porque não vieram APKs nem URLs confirmadas. Por isso a página mostra Download em preparação, sem links falsos. No aplicativos-downloads.json, preencha url com o endereço HTTPS público e version com a versão correspondente de cada aplicativo. Pode ser o APK hospedado no R2 ou uma página de Release pública. O botão é ativado automaticamente após publicar esse arquivo. Não coloque um link de artifact privado/temporário do Actions como download público.

Portal corresponde ao Capacitor; Companion ao Kotlin. Não foi afirmado que ambos podem ser instalados juntos, pois falta conferir os applicationIds. A página também não promete atualização automática do conteúdo do Capacitor sem verificar a configuração dele. Mínimo Android 8.0 informado somente no Companion, conforme minSdk 26 do projeto.

Sem APKs incluídos e sem publicação efetuada. Imagens remotas/pastas omitidas permanecem dependentes dos arquivos já publicados no site.

## Verificação realizada

HTML analisado, IDs da página sem duplicação, JavaScript dos arquivos alterados verificado com node --check e ZIP conferido. A tentativa de validação visual local não pôde executar porque o navegador Chromium não está instalado neste ambiente. As imagens das pastas pesadas não vieram no ZIP e não foram validadas localmente.
