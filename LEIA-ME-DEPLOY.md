# Helldivers BR — Home mobile enxuta + PWA (versão 2)

Este pacote é uma atualização para aplicar SOBRE o repositório atual. O ZIP de origem tinha apenas 17 arquivos; imagens, áudio, dados e páginas em subpastas não estavam incluídos. Não apague essas pastas do GitHub.

## Publicar

1. Extraia o ZIP e copie seu conteúdo para a raiz do repositório Helldivers-BR, substituindo os arquivos de mesmo nome e adicionando os novos.
2. Preserve `imagens/`, `audio/`, `dados/`, `warbonds/`, `discord/`, `inimigos/`, `.github/` e os demais arquivos que já existem no repositório.
3. Faça commit e aguarde a publicação habitual do GitHub Pages. Não exige instalação de dependências nem etapa de build.
4. Abra o site publicado por HTTPS no Chrome do Android. No menu lateral, “Instalar Helldivers BR” aparece quando o navegador libera a instalação. Também pode usar o menu do Chrome → Instalar app. Não teste abrindo o HTML diretamente como arquivo.
5. Abra pelo ícone instalado: a janela deve ficar independente, sem a barra normal do navegador. A confirmação final em Android físico deve ser feita depois do deploy.

## O que mudou

- Home até 768 px: introdução curta, cinco cards de destino (Central, Mapa, Estratagemas, Warbonds e Facções), resumo da Ordem Maior e acesso ao Discord. A barra inferior foi mantida. Os painéis detalhados, o acesso rápido duplicado e as seções institucionais ficam na apresentação desktop; no celular os links levam às páginas existentes.
- O resumo da Ordem Maior reaproveita os dados existentes e identifica um último registro quando não há confirmação de atualização. Não inventa um objetivo se a API estiver indisponível.
- No teste local a 390 px, a Home passou de 4.166 para 1.132 px de altura. A altura real varia com fontes, dados e preferências de zoom.
- CSS desktop preservado. O teste local comparou capturas de 1440 px e confirmou igualdade pixel a pixel.
- Manifest com caminhos relativos ao repositório, `standalone`, ícones PNG 192/512 e ícone maskable. O ícone criado é um monograma HD BR em amarelo/preto, pois a imagem do logotipo não veio no ZIP.
- Registro compartilhado em `theme.js`, também para páginas em subpastas que já carreguem esse arquivo. Todas as páginas HTML fornecidas têm registro e manifest explícitos.
- Tela de falta de conexão. Dados da guerra exigem internet; este pacote não promete disponibilizar todo o site offline.

## Novos deploys e atualização segura

HTML, JavaScript e CSS são buscados na rede com revalidação; não são retidos no cache do service worker. Assim, um deploy normal aparece na próxima navegação ou recarga, sem exigir que o usuário desinstale a PWA. O endereço, o manifest e a identidade da instalação continuam os mesmos. Uma página que já está aberta não é recarregada à força.

**Agora também há aviso para alterações de conteúdo/estilo/código, sem precisar mudar o service worker.** `deploy-check.js` compara os arquivos das páginas fornecidas, seus CSS/JS e o manifest. Também acompanha a página atual e seus scripts/estilos locais, inclusive em subpastas. Estabelece uma referência ao abrir e verifica novamente a cada cinco minutos enquanto a página está visível, ao retornar após um minuto e ao recuperar a conexão. Confirma o resultado novamente antes de exibir “Atualizar agora” ou “Agora não”. Falhas de rede/arquivos indisponíveis adiam a verificação; não geram aviso falso.

O aviso aparece DENTRO do site/app. Não é uma notificação push com o aplicativo fechado e não exige permissão de notificações. Se a pessoa já abriu a versão atualizada, não precisa receber aviso: ela já está usando os arquivos novos. O verificador usa requisições HTTP com revalidação e não inclui APIs/JSON da guerra. Uma mudança de dados ao vivo não é um novo deploy.

Limite do verificador: alterações apenas de imagens, áudio ou páginas de subpastas que não estejam abertas não são acompanhadas. Elas chegam normalmente pela rede. Para anunciar também uma entrega exclusivamente desses arquivos, altere `VERSION` em `sw.js`, ou acrescente o arquivo estático desejado à lista `paths` de `deploy-check.js`. Não inclua feeds de dados nessa lista.

Se alterar `sw.js` ou a tela `offline.html`, troque `VERSION` em `sw.js`. O navegador detecta a nova versão ao navegar e ao retornar para o app após um minuto. Quando existe uma versão aguardando, aparece “Atualizar agora”; a ativação e a recarga acontecem quando o usuário toca. Uma outra aba aberta continua sem recarga forçada, e recebe os arquivos atuais na próxima navegação.

O cache contém apenas a tela offline. A limpeza se limita ao prefixo e escopo deste app, preservando caches de outros projetos no mesmo domínio. APIs e JSON não são armazenados pelo novo service worker. O armazenamento de dados que já existia no código da guerra foi preservado.

## Validação realizada

- Microsoft Edge/Chromium 153, automatizado, perfil normal: manifest sem erros e lista de erros de instalabilidade vazia.
- Larguras 320, 360, 390, 430 e 768 px: sem transbordamento horizontal da página; cards e navegação inferior disponíveis.
- Cards: deslocamento e indicador sincronizados; menu superior/inferior e fechamento por Escape.
- Home compacta: painéis repetidos ocultos no celular, cinco destinos, resumo e Discord; resumo sincronizado com os estados atual/último registro.
- Deploy só de CSS: aviso exibido com service worker inalterado, sem recarga automática, recarga por clique e sem aviso repetido após atualizar.
- Service worker: registro no subdiretório `/Helldivers-BR/`, controle da página, atualização aguardando clique, recarga e preservação de cache de outro site.
- Falta de conexão e retorno à página após reconectar.
- Desktop: captura idêntica à versão original em 1440 px.

Limites: as comparações usaram os arquivos fornecidos, sem imagens/áudio ausentes, fontes externas ou APIs ao vivo. A instalação em Android físico e a aparência com todos os assets precisam de conferência após publicar. As páginas ausentes do ZIP permanecem sob responsabilidade do repositório existente; suas referências foram mantidas.

Referência dos requisitos de instalação: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
