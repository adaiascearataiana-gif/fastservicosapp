# Relatório FAST Serviços — Desktop e Linux 2.3.8

Data da validação: 06/09/2026

## Resultado executivo

- Versão web desktop testada em 1363 × 936.
- Modo desktop identificado corretamente.
- Barra lateral visível e barra superior fixa.
- Conteúdo principal alinhado, sem estouro ou rolagem horizontal.
- Nenhum erro do aplicativo registrado no console durante a abertura.
- Aplicativo Linux sincronizado com a plataforma web 2.3.8.
- Ponte segura do Electron restaurada no HTML (`desktop-bridge.js`).
- Scanner Linux aprovado: 735 IDs iniciais únicos e nenhuma credencial GitHub ou Supabase administrativa exposta.
- AppImage e pacote DEB gerados e validados para arquitetura x86-64/amd64.

## Instaladores gerados

| Arquivo | Formato | Tamanho aproximado | SHA-256 |
|---|---:|---:|---|
| `FAST-Servicos-2.3.8-x86_64.AppImage` | AppImage | 112 MB | `868998b005e8c7e314eb632fd5c2a578634552107a4761bda634d9f6354ecdff` |
| `FAST-Servicos-2.3.8-amd64.deb` | Debian/Ubuntu | 88 MB | `9bf3611441b31c01f23afe53c70f22e3f8db0a0c4445de36d89e1cdeefa442b9` |

## Instalação recomendada — Ubuntu, Debian e Linux Mint

Baixe o arquivo `.deb`, abra o terminal e execute:

```bash
cd ~/Downloads
sudo apt install ./FAST-Servicos-2.3.8-amd64.deb
```

O aplicativo aparecerá no menu como **FAST Serviços**.

Para remover:

```bash
sudo apt remove fast-servicos-linux
```

## Instalação portátil — AppImage

```bash
cd ~/Downloads
chmod +x FAST-Servicos-2.3.8-x86_64.AppImage
./FAST-Servicos-2.3.8-x86_64.AppImage
```

Em sistemas que exigirem FUSE:

```bash
sudo apt update
sudo apt install libfuse2
```

## Gerar os instaladores pelo código-fonte

Requer Node.js 20 ou superior e npm:

```bash
cd fastservicosapp/linux
chmod +x scripts/install.sh scripts/configure.sh
./scripts/install.sh
```

Os arquivos serão criados em `linux/dist/`.

## Observações

- Os dados continuam sincronizados pelo Supabase conforme a configuração da plataforma.
- O Google Drive continua dependendo da autorização OAuth do proprietário.
- O pacote não contém token GitHub nem chave `service_role`.
- Antes de trocar de computador, deve-se executar um backup ou ponto de restauração dentro do FAST.
