# Lista de Compras Inteligente

Aplicativo web estático e instalável como PWA para organizar uma lista de compras, acompanhar itens no carrinho, registrar histórico mensal e manter preços localmente no navegador.

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura semântica da interface e modais. |
| `styles.css` | Estilos visuais da aplicação. |
| `app.js` | Estado, persistência, regras de negócio, renderização e eventos. |
| `sw.js` | Cache offline e atualização da PWA. |
| `manifest.json` | Configuração de instalação e identidade da PWA. |
| `icon-192x192.png` / `icon-512x512.png` | Ícones da aplicação. |

## Dados e compatibilidade

Os dados continuam sendo armazenados localmente no navegador usando a chave `smart_shopping_list_v6`. A 3ª edição mantém essa chave para evitar perda de dados. A aplicação também continua tentando ler a chave legada `smart_shopping_list_v1`.

Antes de atualizar a aplicação, recomenda-se usar o botão **Criar Backup**. O arquivo pode ser restaurado pelo botão **Restaurar**. A restauração agora valida a estrutura básica e normaliza valores antes de substituir o estado atual.

## Melhorias da 3ª edição

A busca de produtos, mercados e colaboradores ignora diferenças de acentuação e capitalização. Assim, `água`, `agua` e `ÁGUA` podem ser encontrados pela mesma busca. A ordenação utiliza comparação adequada ao português.

Os nomes de produtos são normalizados para comparação, evitando a inclusão de novos duplicados com grafias equivalentes. Os registros antigos não são apagados automaticamente. A edição do item permite alterar seu nome, tipo, quantidade e preço.

Marcar um item como estando no carrinho não abre mais automaticamente a tela de edição. A conferência continua disponível ao clicar no item.

A renderização de nomes, mercados, colaboradores e itens históricos passou a usar elementos DOM e texto, reduzindo o risco de injeção de HTML a partir de dados restaurados. Backups, quantidades, preços e tipos também passam por validação e normalização.

O service worker foi atualizado para incluir os arquivos separados no cache inicial, descartar caches antigos por versão e limitar a interceptação a requisições `GET` da própria aplicação.

## Publicação local

Como é uma aplicação estática, os arquivos podem ser publicados em GitHub Pages ou em qualquer servidor de arquivos estáticos. Para desenvolvimento local, é necessário servir a pasta por HTTP; abrir diretamente via `file://` pode impedir recursos de PWA, como service worker e armazenamento persistente.

## Retorno à versão anterior

A versão anterior foi preservada no branch local `edicao-2-estavel`. A edição em desenvolvimento está no branch local `edicao-3`. A versão original também permanece no branch `main` local e no repositório remoto até que uma publicação seja solicitada.
