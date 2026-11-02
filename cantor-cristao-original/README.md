# Cantor Cristão — edição original para violão/teclado

A fonte indicada pelo usuário é [Coletânea Cantor Cristão](https://sites.google.com/site/coletaneacantorcristao/seja-bem-vindoa). No **item 10** dessa página, o próprio projeto oferece uma edição comemorativa (14/02/2024) com as **cifragens simplificadas em tom original reunidas em um único PDF**:

https://drive.google.com/file/d/1GDa14b-S0_RRlhRhw1g4Jgd-xcVUhWM7/view?usp=sharing

O projeto pede expressamente que não se baixem todas as peças de suas pastas do Dropbox de uma só vez, para evitar o bloqueio dos links. Por isso **não foi implementado um crawler nem download em massa**. O PDF único publicado pelo projeto é a solução para obter a coletânea original sem misturar versões em outros tons.

Abra `index.html` no navegador, acesse o PDF no Google Drive e use o botão de download do Drive. Depois selecione o PDF baixado no app para guardar uma cópia com nome padronizado. O app valida a assinatura `%PDF-`, mas **não verifica a numeração interna nem separa os 581 hinos**: confira o índice do PDF. O arquivo nunca é transmitido para um servidor por este app. Este repositório não redistribui o PDF de terceiros.

## Remover as páginas 1 e 2

1. Baixe o PDF no link oficial.
2. Abra `index.html` e selecione o PDF baixado.
3. Clique em **Remover páginas 1 e 2 e baixar**. O app salva uma **nova cópia** com nome `Cantor_Cristao_Tom_Original_Violao_Teclado_sem_paginas_01-02.pdf`. O arquivo original não é alterado.

Esta operação usa `pdf-lib` 1.17.1 (licença MIT, incluída em `vendor/`) inteiramente no navegador, inclusive quando o app é aberto diretamente do disco. Não depende de serviços externos para modificar o PDF. PDFs grandes podem consumir memória; se o navegador não conseguir processar, tente em um computador. Teste local: `node --test cantor-cristao-original/pdf-ops.test.js`.
