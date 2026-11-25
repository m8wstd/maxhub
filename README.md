# Maxhub

Hub pessoal de produtividade para um único usuário: tarefas, notas e prazos, com interface responsiva instalável como PWA.

## Stack

- Next.js App Router, React e TypeScript
- Tailwind CSS e shadcn/ui
- Vercel Blob SDK (`@vercel/blob`)
- Hospedagem Vercel (deploy Next.js sem configuração adicional)
- Manifesto, ícones e service worker para instalação como PWA

## Funcionalidades do MVP

- Acesso por senha única, com hash `scrypt` configurado somente no servidor e sessão em cookie `HttpOnly`.
- Grupos personalizáveis (Faculdade e Projetos no primeiro acesso), com Geral como visão agregada; tarefas, subtarefas, prioridades, cores, datas, status, arquivamento e lixeira restaurável por 30 dias.
- Visões Hoje, Amanhã, dias restantes da semana (domingo a sábado), Depois e Atrasadas; datas interpretadas em `America/Sao_Paulo`. Tarefas sem prazo entram em Hoje.
- Calendário em listas por período, notas soltas por grupo e notas ligadas a tarefas com edição e visualização Markdown básica.
- Sincronização do snapshot em Blob privado, com ETag e escrita condicional para detectar alterações simultâneas.

## Desenvolvimento local

Requer Node.js 20.9 ou superior.

```bash
npm install
npm run hash-password
# Cole a linha impressa em .env.local.
openssl rand -base64 32
# Configure MAXHUB_SESSION_SECRET em .env.local com o valor gerado.
npm run dev
```

Sem `BLOB_READ_WRITE_TOKEN`, `next dev` usa um arquivo local em `.maxhub-dev/workspace.json` para facilitar testes; a interface indica claramente esse modo e os dados não são enviados à Vercel. Esse armazenamento é exclusivo para desenvolvimento e não é usado em produção. Para testar sincronização remota, associe um **Blob privado** e defina `BLOB_READ_WRITE_TOKEN` no ambiente local. Nunca exponha esse token em variáveis `NEXT_PUBLIC_*`.

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
2. Crie ou associe um armazenamento **privado** Blob no projeto; a integração configura `BLOB_READ_WRITE_TOKEN` no ambiente escolhido.
3. Configure `MAXHUB_PASSWORD_HASH` (gerado pelo script) e `MAXHUB_SESSION_SECRET` distinto em cada ambiente. Não use a senha em texto claro como variável.
4. Para desenvolvimento local, obtenha o token nas configurações de Storage da Vercel e mantenha-o em `.env.local` (ou use `vercel env pull .env.local` após vincular o projeto).
5. Escolha um domínio para produção e configure DNS no painel Vercel.

## Segurança e limites conhecidos

- O conteúdo fica em um único objeto Blob **privado**, lido e gravado apenas em rotas server-side após validar a sessão. Não há endpoint direto de upload ou URL pública dos dados.
- Cada sincronização substitui o snapshot inteiro com `ifMatch` do ETag; conflitos são detectados e mesclados por registro usando `updatedAt`, evitando sobrescrita silenciosa. Alterações simultâneas no mesmo registro usam a revisão mais recente; não há histórico de versões nem garantias transacionais de banco.
- O snapshot tem limite de 1 MB. Itens da lixeira com mais de 30 dias deixam de ser retornados quando o armazenamento é lido e são removidos fisicamente na próxima gravação; não há tarefa agendada de limpeza.
- A sessão assinada expira em 7 dias. O limite de tentativas de senha não é distribuído/persistente; proteja a rota de login com controles de tráfego da hospedagem antes de expor a produção à Internet.
- A troca do hash da senha invalida sessões existentes; a troca do segredo de sessão também invalida todas as sessões.
- O logout remove o cookie do navegador; como a sessão é stateless, uma cópia já roubada do token não é revogada no servidor e permanece válida até expirar.
- Como Blob não é banco de dados, este MVP destina-se a uma pessoa e baixo volume. Para concorrência forte, auditoria, backups granulares ou uso multiusuário será necessário um banco de dados.
- O manifesto/service worker já permite instalação; os dados sincronizam no servidor e não há modo offline de escrita. Markdown suporta títulos, listas, negrito e código inline, não toda a especificação CommonMark.
- O armazenamento local em `next dev` é apenas um recurso de teste sem Blob; o arquivo fica ignorado pelo Git, não é criptografado e não deve conter dados sensíveis. Produção exige um Blob privado configurado.
- O modo calendário lista prazos nas visões confirmadas (Hoje, Amanhã, restante da semana e Depois); não implementa grade mensal/semanal/diária.
