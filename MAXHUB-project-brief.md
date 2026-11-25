# Maxhub — Briefing do projeto

> Documento-base do Maxhub, organizado segundo a estrutura do briefing do SGTCC. O SGTCC é outro projeto e serve apenas como referência de organização: seus requisitos, atores e escolhas técnicas não são requisitos do Maxhub. Este documento registra as decisões compartilhadas até 25/11/2026; itens sem informação confirmada permanecem como “A definir”.

## 1. Tarefas e entregas

### Prioridade

- **A definir:** prioridades, prazos e critérios de conclusão do projeto.

### Entregas

- **A definir:** marcos, datas, links e formato de entrega.

### Outras

- **A definir.**

### Concluídas

- **25/11/2026 — MVP implementado:** código de autenticação individual, grupos, tarefas, notas, calendário, lixeira e interface PWA presente no checkout selecionado.
- **25/11/2026 — Validações técnicas:** `npm run lint`, `npm run typecheck` e `npm run build` concluíram com sucesso neste checkout.
- **Pendente:** configurar uma Blob Store privada e `BLOB_READ_WRITE_TOKEN` para testar a persistência e sincronização remotas; esse fluxo não foi exercitado.

## 2. Visão geral da arquitetura

O Maxhub será um hub pessoal de produtividade, instalável em celular e computador. A experiência deve facilitar a organização de tarefas e notas por grupos, com vistas temporais e calendário. O design de referência enviado pelo usuário inspira-se no Tappsk: interface clara, navegação inferior, listas de tarefas e um painel de detalhes ao lado no desktop. Essa referência visual orienta o produto, sem exigir uma cópia exata.

### Módulos previstos

- **Tarefas:** grupos como Faculdade, projetos individuais e Geral; campos editáveis de prazo, prioridade, cor e grupo; tarefas podem ter subtarefas, status e arquivamento.
- **Tarefas e Hoje:** a aba Tarefas organiza Hoje, Amanhã, cada dia restante da semana atual, Depois (semana seguinte em diante) e Atrasadas. Domingo é o primeiro dia da semana. Tarefas sem prazo permanecem em Hoje; tarefas vencidas continuam no grupo original.
- **Calendário:** grade mensal real com navegação entre meses, semana de domingo a sábado e seleção de dia. Dias com tarefas que têm prazo são marcados; selecionar um dia filtra a lista de prazos, e sem seleção a lista mostra os prazos do mês. Tarefas sem prazo não aparecem como eventos.
- **Notas sincronizadas:** múltiplas notas por grupo e por tarefa; notas de tarefa também servem de etiquetas/contexto, sem criar um sistema separado de etiquetas. Editar em Markdown com visualização renderizada semelhante ao Notion.
- **Detalhes da tarefa:** ao selecionar uma tarefa, mostrar seus detalhes e notas relacionadas ao lado da lista em telas de computador; adaptar a apresentação para dispositivos móveis.
- **Autenticação:** entrada protegida pela senha pessoal do único usuário da plataforma.
- **Persistência e sincronização:** manter tarefas e notas sincronizadas usando Vercel Blob, minimizando conflitos de edição.
- **Lixeira:** tarefas e grupos excluídos ficam na Lixeira por 30 dias antes da exclusão permanente. Excluir um grupo envia também suas tarefas para a Lixeira.
- **Experiência instalável (PWA):** priorizar Chrome, Android, Linux e Windows, respeitando o suporte de instalação disponível em cada plataforma.
- **Interface:** usar Quicksand nos títulos e Inter nos textos; demais escolhas visuais podem ser propostas e refinadas com o usuário.

O detalhamento dos módulos e suas relações será definido com as próximas informações do projeto.

### Estado técnico do MVP em 25/11/2026

- O acesso usa hash de senha `scrypt` e sessão assinada com HMAC em cookie `HttpOnly`, com validade de sete dias. O logout remove o cookie do navegador; não há revogação server-side de um token já copiado nem limite de tentativas persistente.
- A implementação de sincronização usa um snapshot JSON privado no Blob, escrita condicional com ETag e tentativa de mesclagem por registro usando `updatedAt`. A sincronização remota ainda depende de uma Blob Store privada e de `BLOB_READ_WRITE_TOKEN`; não foi testada contra uma instância Blob.
- Em `next dev` sem token, há armazenamento alternativo em `.maxhub-dev/workspace.json`, exclusivo para desenvolvimento e sem sincronização com a Vercel. Não é fallback de produção.
- O snapshot tem limite de 1 MB. Itens da Lixeira expirados deixam de ser retornados quando o workspace é normalizado e são removidos fisicamente na próxima gravação; não há limpeza agendada.
- A interface implementa a base PWA e registra o service worker em produção. A prévia Markdown do MVP cobre um subconjunto da sintaxe, não toda a especificação CommonMark.

## 3. Atores e usuários

- **Usuário principal:** uma única pessoa usando o hub para organizar tarefas e notas de produtividade pessoal.
- **Autenticação:** uma senha pessoal para entrar na plataforma; não há outros usuários no escopo atual.

## 4. Regras de negócio

- **RN01 — Organização por grupos:** tarefas podem pertencer a grupos, incluindo grupos de projetos ou Faculdade; o grupo Geral reúne todas as tarefas.
- **RN02 — Campos editáveis:** prazo, prioridade, cor e grupo de uma tarefa podem ser alterados.
- **RN03 — Vistas de prazo:** mostrar Hoje, Amanhã, os dias seguintes até o fim da semana atual e Depois, que reúne a semana seguinte em diante.
- **RN04 — Semana e fuso:** considerar domingo como primeiro dia da semana e o fuso de Brasília.
- **RN05 — Tarefas sem prazo:** mantê-las na lista Hoje, inclusive após a passagem dos dias, até que recebam prazo ou sejam concluídas/arquivadas.
- **RN06 — Atraso:** tarefa com prazo vencido deve ter estado atrasado e continuar vinculada ao mesmo grupo.
- **RN07 — Notas associadas:** permitir múltiplas notas por grupo e por tarefa; notas de tarefa cumprem também o papel de etiquetas/contexto.
- **RN08 — Markdown:** editar tarefas/notas em Markdown e disponibilizar visualização formatada no estilo do Notion.
- **RN09 — Sincronização:** sincronizar tarefas e notas entre os dispositivos do usuário por meio do armazenamento definido com Vercel Blob, buscando minimizar conflitos.
- **RN10 — Tema:** inicialmente oferecer apenas modo claro, usando `#47b8ec` como cor de tema.
- **RN11 — Conta individual:** o sistema terá um único usuário, que acessa com sua senha pessoal.
- **RN12 — Lixeira:** manter tarefas e grupos excluídos por 30 dias antes de removê-los permanentemente; excluir um grupo também envia suas tarefas à Lixeira.
- **RN13 — Lembretes:** não incluir lembretes ou notificações nesta etapa.
- **RN14 — Tipografia:** usar Quicksand em títulos e Inter em textos; os demais elementos visuais podem ser propostos e ajustados iterativamente.

## 5. Requisitos funcionais

- **RF01 — Aba Tarefas:** listar tarefas separadas em grupos, por exemplo Faculdade, Projeto Tal, Projeto Fulano e Geral; Geral deve exibir todas as tarefas.
- **RF02 — Propriedades da tarefa:** permitir editar prazo/data, prioridade, cor e grupo da tarefa.
- **RF03 — Organização temporal na aba Tarefas:** apresentar Hoje, Amanhã, cada dia restante da semana atual, Depois (semana seguinte em diante) e Atrasadas; tarefas sem prazo ficam em Hoje e tarefas vencidas permanecem no grupo original.
- **RF04 — Aba Calendário:** apresentar uma grade mensal com semanas de domingo a sábado, navegação para mês anterior/próximo e dias com tarefas que têm prazo marcados. Selecionar um dia mostra seus prazos; sem seleção, mostrar os prazos do mês. Respeitar o grupo e o estado de cada tarefa; não transformar tarefas sem prazo em eventos.
- **RF05 — Aba Notas:** apresentar múltiplas notas sincronizadas organizadas por grupo e permitir editar seu conteúdo em Markdown, com visualização formatada.
- **RF06 — Notas de grupo e tarefa:** permitir várias notas soltas em cada grupo e várias notas vinculadas a tarefas; usar as notas da tarefa como etiquetas/contexto, sem etiquetas separadas.
- **RF07 — Detalhes e notas da tarefa:** ao selecionar uma tarefa, mostrar os detalhes e as notas associadas junto à lista no desktop; oferecer uma apresentação adaptada em mobile.
- **RF08 — Aba Hoje:** mostrar tarefas com prazo para hoje e tarefas sem prazo, mantendo estas últimas em Hoje até que o usuário defina prazo ou as conclua/arquive.
- **RF09 — Atrasadas:** identificar tarefas com prazo vencido como atrasadas, sem removê-las de seu grupo.
- **RF10 — Subtarefas, status e arquivamento:** permitir subtarefas, alterar status de tarefas e arquivar tarefas.
- **RF11 — Lixeira:** mover tarefas excluídas para Lixeira; permitir restaurá-las durante 30 dias, depois dos quais são excluídas permanentemente.
- **RF12 — Grupos:** permitir criar, renomear, reordenar, arquivar e excluir grupos; excluir move o grupo e suas tarefas para Lixeira por 30 dias.
- **RF13 — Autenticação por senha:** permitir ao único usuário entrar com sua senha pessoal.
- **RF14 — Sincronização com Blob:** sincronizar tarefas e notas através do armazenamento Vercel Blob, minimizando conflitos.
- **RF15 — Aplicação instalável:** permitir instalação em navegadores/sistemas compatíveis, priorizando Chrome, Android, Linux e Windows.
- **RF16 — Tema e tipografia:** manter apenas modo claro com `#47b8ec`; usar Quicksand nos títulos e Inter nos textos.
- **RF17 — Integrações futuras:** deixar o produto aberto a integrações que forem especificadas depois.

## 6. Requisitos não funcionais

- **RNF01 — Responsividade:** adaptar toda a experiência a dispositivos móveis e computadores.
- **RNF02 — Instalabilidade:** oferecer PWA instalável nos sistemas operacionais e navegadores compatíveis.
- **RNF03 — Sincronização entre dispositivos:** manter tarefas e notas sincronizadas por meio do Blob.
- **RNF04 — Segurança:** proteger o acesso por senha; requisitos técnicos adicionais ainda serão definidos.
- **RNF05 — Persistência de texto:** preservar conteúdo Markdown em tarefas e notas.
- **RNF06 — Consistência:** minimizar conflitos ao sincronizar e editar dados em múltiplos dispositivos.
- **RNF07 — Retenção da Lixeira:** aplicar retenção de 30 dias antes da exclusão permanente de itens removidos.

## 7. Tecnologias

- **Componentes de design:** shadcn/ui.
- **Frontend:** React, Next.js e Tailwind CSS.
- **Armazenamento de dados/arquivos:** Vercel Blob.
- **Hospedagem e domínio:** Vercel.
- **PWA:** base nativa com manifest e service worker.
- **Outras integrações e serviços:** A definir.

## 8. Impacto e benefícios esperados

- Reunir ferramentas de produtividade em um hub pessoal.
- Organizar tarefas em períodos diários, semanais e mensais.
- Agrupar tarefas por áreas pessoais e projetos, com uma visão Geral.
- Consultar todos os prazos em calendário e notas relacionadas no contexto da tarefa.
- Permitir acesso instalável tanto no celular quanto no computador.
- Sincronizar tarefas e notas entre os dispositivos.

## 9. User Stories e critérios de aceitação

### US01 — Tarefas agrupadas

Como único usuário do Maxhub, quero separar tarefas em grupos e consultar uma visão Geral para organizar áreas pessoais e projetos sem perder uma visão completa.

- **AC1 — Grupos:** tarefas podem ser atribuídas a um grupo, como Faculdade ou um projeto.
- **AC2 — Geral:** a seção Geral apresenta tarefas de todos os grupos.
- **AC3 — Campos:** o usuário pode editar prazo, prioridade, cor e grupo de uma tarefa.

### US02 — Organização temporal de tarefas

Como usuário, quero ver tarefas organizadas pelo prazo para identificar o que precisa de atenção agora e depois.

- **AC1 — Seções:** a aba Tarefas apresenta Hoje, Amanhã, cada dia restante da semana atual e Depois.
- **AC2 — Semana:** domingo é o primeiro dia e sábado o último dia da semana; Depois começa na semana seguinte.
- **AC3 — Sem prazo:** tarefas sem data permanecem em Hoje mesmo após a passagem dos dias.
- **AC4 — Atraso:** tarefas com prazo vencido são identificadas como atrasadas e permanecem no grupo original.
- **AC5 — Aba Hoje:** mostra as tarefas cuja data é hoje, além das tarefas sem prazo.

### US03 — Calendário e prazos

Como usuário, quero visualizar prazos em um calendário mensal e consultar as tarefas de cada dia.

- **AC1:** exibir uma grade mensal iniciada no domingo, com controles para navegar entre meses.
- **AC2:** marcar na grade os dias que têm tarefas com prazo; ao selecionar um dia, listar apenas os prazos daquela data; sem dia selecionado, listar os prazos do mês.
- **AC3:** a lista respeita o filtro de grupo e preserva grupo e estado das tarefas; selecionar uma tarefa abre os detalhes existentes.
- **AC4:** tarefas sem prazo continuam em Hoje na aba Tarefas e não são posicionadas como eventos no calendário.

### US04 — Notas de grupos e tarefas

Como único usuário, quero escrever várias notas Markdown soltas num grupo ou associadas a uma tarefa para manter contexto junto à minha organização.

- **AC1:** cada grupo pode conter notas independentes de tarefas.
- **AC2:** uma tarefa pode ter várias notas associadas.
- **AC3:** edição de notas e tarefas suporta conteúdo Markdown com visualização formatada semelhante ao Notion.
- **AC4:** notas e tarefas permanecem sincronizadas pelo armazenamento definido com Blob, com estratégia que minimize conflitos.
- **AC5:** em telas de computador, selecionar uma tarefa mostra seus detalhes e notas associadas ao lado da lista; em mobile, os detalhes são apresentados em layout adaptado.

### US05 — Acesso seguro

Como único usuário, quero entrar no Maxhub com minha senha pessoal para proteger minhas tarefas e notas.

- **Critérios de aceitação:** permitir acesso ao único usuário cadastrado mediante senha válida; demais critérios de segurança a definir.

### US06 — Instalação e uso mobile

Como usuário, quero instalar o Maxhub no computador ou celular para usá-lo como aplicação.

- **AC1:** disponibilizar instalação PWA em plataformas e navegadores compatíveis, priorizando Chrome em Linux, Windows e Android.
- **AC2:** todas as telas e interações são adaptadas a dispositivos móveis.

### US07 — Excluir e recuperar itens

Como usuário, quero recuperar tarefas e grupos excluídos antes da remoção permanente.

- **AC1:** tarefa excluída vai para Lixeira e pode ser restaurada por até 30 dias.
- **AC2:** grupo excluído e as tarefas nele contidas vão para Lixeira.
- **AC3:** itens na Lixeira são removidos permanentemente após 30 dias.

### Outras histórias

- **Integrações externas:** A definir conforme ferramentas e necessidades forem escolhidas.

## 10. Diagrama de classes

- **Status:** A definir.
- **Artefato/link:** A definir.

## 11. Diagrama entidade-relacionamento

- **Status:** A definir.
- **Artefato/link:** A definir.

## 12. Personas

- **Usuário pessoal de produtividade:** precisa organizar tarefas de faculdade e múltiplos projetos num só lugar, consultar prazos e guardar contexto em notas. Outras personas podem ser adicionadas se houver colaboração ou perfis distintos.

## 13. User Journeys

### Jornada 1 — Organizar tarefas por grupo e prazo

O usuário abre Tarefas, cria ou seleciona grupos como Faculdade e projetos, adiciona tarefas e ajusta data, prioridade, cor e grupo. A lista organiza o trabalho entre Hoje, Amanhã, os dias restantes até sábado e Depois, que começa no domingo seguinte. Geral reúne tarefas de todos os grupos; tarefas sem prazo continuam em Hoje e tarefas vencidas são marcadas como atrasadas dentro do grupo.

### Jornada 2 — Consultar o dia

O usuário abre Hoje para ver as tarefas com prazo do dia atual e as tarefas sem prazo. Tarefas com prazo vencido permanecem em seu grupo com estado atrasado. Ao selecionar uma tarefa, consulta ou edita detalhes, status, subtarefas e notas Markdown.

### Jornada 3 — Consultar prazos

O usuário abre Calendário, navega entre meses numa grade de domingo a sábado e seleciona um dia para consultar seus prazos. Sem um dia selecionado, consulta os prazos do mês. Tarefas sem prazo continuam em Hoje na aba Tarefas e não aparecem como eventos.

### Jornada 4 — Registrar contexto em notas

O usuário escreve múltiplas notas Markdown soltas num grupo ou associa notas a uma tarefa. No computador, ao selecionar a tarefa, lê e edita o contexto ao lado da lista; no celular, acessa a mesma informação numa apresentação adaptada. As alterações sincronizam entre dispositivos usando Blob, minimizando conflitos.

### Jornada 5 — Acessar como aplicação

O usuário autentica-se com sua senha pessoal, instala o Maxhub como PWA usando Chrome em Linux, Windows ou Android (conforme suporte da plataforma) e usa a interface responsiva.

## 14. Pontos em aberto

- **Horários e recorrência:** ainda não definido se tarefas terão hora ou recorrência.
- **Sincronização:** o MVP usa snapshot privado no Blob, ETag e escrita condicional; a sincronização remota ainda precisa de configuração e teste. Blob é armazenamento de objetos, não banco de dados; avaliar um banco se o volume, a concorrência ou os requisitos de auditoria crescerem.
- **Offline:** não há modo offline de escrita na aplicação. O arquivo local em `.maxhub-dev` é apenas um recurso de desenvolvimento sem Blob e não sincroniza com outros dispositivos.
- **Integrações futuras:** quais ferramentas devem ser priorizadas?
- **Design:** tipografia definida como Quicksand nos títulos e Inter nos textos; ícones, estados vazios e acessibilidade podem ser propostos e refinados.

## 15. Histórico de atualização

| Data | Atualização |
|---|---|
| 25/11/2026 | Criada estrutura inicial para Maxhub com os fatos já compartilhados; seções pendentes permanecem explicitamente em aberto. |
| 25/11/2026 | Adicionados grupos e propriedades de tarefas, organização temporal, Hoje, calendário, notas Markdown por grupo/tarefa, autenticação por senha, sincronização com Blob, tema claro azul e requisitos PWA/mobile. Registrada a orientação visual das capturas anexadas. |
| 25/11/2026 | Confirmado uso individual com senha; domingo como início da semana e fuso de Brasília; tarefas sem prazo ficam em Hoje e tarefas vencidas são atrasadas no grupo original; adicionados subtarefas, status, arquivamento e Lixeira com retenção de 30 dias; múltiplas notas e minimização de conflitos; Chrome em Android/Linux/Windows; fontes Quicksand e Inter. |
| 25/11/2026 | Registrado o estado do MVP e suas limitações verificadas; lint, typecheck e build passaram neste checkout. Blob remoto segue pendente de configuração e teste. |
| 25/11/2026 | Separada a aba Tarefas (períodos temporais e Atrasadas) da aba Calendário, agora mensal, com navegação, seleção de dia e lista de prazos por dia/mês; tarefas sem prazo não viram eventos. |
