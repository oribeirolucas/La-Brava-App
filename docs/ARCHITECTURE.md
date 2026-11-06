# Arquitetura e conexão futura com backend

## Camadas

1. `app.js` compõe navegação, renderização e ações. Módulos `*-view.js` recebem um contexto com estado, repositório e funções de UI.
2. `Repository` oferece operações de domínio. As telas não acessam localStorage. Funções puras calculam disponibilidade, normalização, estatísticas e ocupação.
3. `LocalStorageAdapter` lê e grava um envelope versionado, valida referências, migra legado e protege uma cópia anterior.

Sem framework, banco, autenticação falsa ou biblioteca de produção. `dist` é a fonte e a pasta de publicação; não é um artefato gerado.

## Contrato usado pelas telas

- `getState()`: `{ schemaVersion, revision, services, barbers, clients, bookings, migrationNotes }`.
- `getClients()`, `saveClient(input)`, `updateClient(id, input, expectedUpdatedAt)`, `deleteClient(id, expectedUpdatedAt)`.
- `getBookings()`, `createBooking(input)`, `updateBooking(id, patch, expectedUpdatedAt)`, `cancelBooking(id, reason, expectedUpdatedAt)`.
- `getServices()`, `saveService(input, id?, expectedUpdatedAt?)`.
- `getBarbers()`, `saveBarber(input, id?, expectedUpdatedAt?)`, `addBlock(barberId, input)`, `removeBlock(barberId, blockId)`.
- Ferramentas locais separadas no adapter: exportar, substituir/restaurar estado, limpar e apagar todas as chaves.

A composição instancia hoje `Repository(LocalStorageAdapter)`. Para uma API, forneça um `ApiRepository` com os mesmos métodos. Escritas das telas já aguardam o resultado pelo contexto `write`. A carga de dados deve passar a `await api.getState()` na função central `refreshState` e nos seus chamadores (`app.js` e atualização de disponibilidade); o restante das telas consome o snapshot mantido no contexto. Não implemente um adapter HTTP que transfira o banco inteiro como mecanismo de concorrência de produção.

## Entidades

- Cliente: `id`, `name`, telefone canônico `55+DDD+número`, e-mail, nascimento opcional como `YYYY-MM-DD`, notas, preferências, tags, consentimento, `archived`, `createdAt`, `updatedAt`.
- Serviço: `id`, nome, descrição, categoria, ordem, `priceCents`, `promoCents` opcional, duração/intervalo em minutos, ativo, componentes opcionais do combo.
- Profissional: `id`, nome, especialidades, ativo, expediente e almoço, dias da semana (0 domingo a 6 sábado), períodos de férias, bloqueios por data e percentual de comissão.
- Reserva: `id`, `code`, `clientId`, `serviceId`, `barberId`, `date`, `time`, `status`, `notes`, `cancellationReason`, `createdAt`, `updatedAt`, snapshots de `priceCents`, `duration`, `buffer` e `commissionPercent`.

Snapshots protegem valores e durações antigos após edições do catálogo; nomes/contatos são resolvidos pelas referências atuais. Serviços e profissionais são desativados em vez de removidos. Clientes com reservas são arquivados; reservas nunca são apagadas por cancelamento. Anonimização individual e retenção legal precisam de política e implementação próprias antes de produção.

## Disponibilidade e fuso

O intervalo ocupado é `[início, início + duração + buffer)`. Intervalos adjacentes são permitidos. Reservas aguardando, confirmadas, concluídas ou faltas ocupam horário; canceladas liberam. Cada gravação revalida o estado atual e exclui a própria reserva na edição. Restaurar cancelamento verifica novamente conflitos e se a data está no futuro.

Agenda em `America/Sao_Paulo`; instantes são comparados com UTC-03:00 (Brasília sem horário de verão vigente), e operações sobre datas civis usam UTC para não cruzar dias no fuso do dispositivo. Caso a legislação de horário de verão mude ou o produto passe a aceitar outros fusos, trocar a conversão por uma biblioteca/Temporal com base IANA atualizada e repetir os testes de transição.

Expediente, almoço, férias e bloqueios são do profissional. A UI gera opções de 30 em 30 minutos a partir do início de cada janela; a camada de domínio valida qualquer horário informado, independentemente do seletor.

## Persistência local e migração

Um envelope em `brava-v2` evita gravar cliente sem reserva quando o cadastro é feito no agendamento. A validação roda antes de cada gravação e no carregamento. IDs aceitam somente caracteres seguros; todos os textos dinâmicos são escapados na UI. O backup é gravado antes de substituir o estado. Falha de armazenamento mantém o formulário aberto e informa que a alteração não foi confirmada.

Migração converte IDs legados, índices de serviços e nomes de profissionais. Somente nomes únicos permitem inferir cliente com confiança; ambiguidades geram um contato recuperado e aviso. Os dados originais ficam nas chaves antigas até limpeza explícita. Reservas canceladas que o protótipo já apagou não podem ser recuperadas.

Web Locks e timestamps/revisões ajudam na cooperação entre abas; não são mecanismo de segurança contra outras aplicações ou adulteração local. `localStorage` não possui ACL, criptografia própria nem capacidade transacional multiusuário.

## API / Supabase real: implantação necessária

1. Autenticar equipe e clientes com um provedor real. Separar permissões administrativas, atendimento e autoatendimento.
2. Adicionar `shop_id` e políticas de isolamento em todas as entidades. Em Supabase, habilitar RLS e testar acessos cruzados. Chave `service_role` fica somente no servidor; uma chave publicável só é aceitável com RLS e políticas corretas.
3. Usar foreign keys e transações. Reserva + eventual cliente devem ser criados atomicamente. Validar no servidor expediente, férias, bloqueios, preço, status, telefone e consentimento.
4. Impedir sobreposição no banco. Por exemplo, em PostgreSQL, constraint de exclusão GiST por `shop_id`, `barber_id` e intervalo `tstzrange` para os status ocupantes; incluir buffer. Tratar bloqueios no mesmo mecanismo transacional, não só em uma consulta prévia no frontend.
5. Usar idempotency key para criação, controle de versão/ETag em edição e erro 409 para conflito. Responder com dados canônicos, nunca confiar em preço ou comissão enviados pelo cliente.
6. Implementar endpoints por entidade e paginação; adaptar carga central do contexto para assíncrona. Ex.: `GET /clients`, `POST /clients`, `PATCH /clients/:id`, `GET /availability`, `POST /bookings`, `PATCH /bookings/:id`, `POST /bookings/:id/cancel`, `/services`, `/barbers` e `/blocks`.
7. Definir retenção, exclusão/anonimização, trilha de auditoria, prova de consentimento, exportação por titular e processo de recuperação. A área local de privacidade não substitui esses controles.
8. Migrar os dados locais por importação autenticada, com preview de conflitos e confirmação; não importar backups automaticamente ao abrir uma conta.

Não há código de conexão, URL, chave ou promessa de backend ativo nesta entrega.
