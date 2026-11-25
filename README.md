# MaxHub

Uma central onde tem aplicativos que eu mesmo fiz para facilitar a minha própria vida.

## Stack

- Next.js App Router, React e TypeScript
- Tailwind CSS e shadcn/ui
- Vercel Blob SDK (`@vercel/blob`)
- Hospedagem Vercel (deploy Next.js sem configuração adicional)
- Manifesto, ícones e service worker para instalação como PWA

## Desenvolvimento local

Requer Node.js 20.9 ou superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

O token `BLOB_READ_WRITE_TOKEN` é necessário somente quando uma integração com Blob for usada. Não o exponha em variáveis `NEXT_PUBLIC_*`.

Verificações disponíveis:

```bash
npm run lint
npm run typecheck
npm run build
```

Para validar a instalação da PWA localmente, use `npm run build && npm start` e instale pelo menu do navegador. O service worker é registrado em builds de produção; `localhost` é considerado um contexto seguro pelos navegadores.

## Interface

O shadcn/ui está inicializado em `components.json`, com estilos em `src/app/globals.css`, componentes em `src/components/ui` e aliases configurados. Adicione componentes conforme necessário:

```bash
npx shadcn@latest add button
```

## Vercel e Blob

1. Importe este repositório em uma conta Vercel; o framework Next.js é detectado automaticamente, sem `vercel.json`.
2. Crie ou associe um armazenamento Blob no projeto Vercel. A integração configura `BLOB_READ_WRITE_TOKEN` no ambiente escolhido.
3. Para desenvolvimento local, obtenha o token nas configurações de Storage da Vercel e mantenha-o em `.env.local` (ou use `vercel env pull .env.local` após vincular o projeto).
4. Escolha um domínio para produção e configure seus registros DNS no painel Vercel; a URL de produção fornecida pela Vercel funciona sem domínio personalizado.

A conta/projeto Vercel, a criação do armazenamento Blob, o token e qualquer domínio personalizado são configurações externas e ainda precisam ser decididos pelo responsável pelo projeto. Nenhum endpoint de upload ou funcionalidade de produto foi adicionado.
