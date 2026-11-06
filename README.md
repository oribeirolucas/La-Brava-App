# BRAVA — App para Barbearias

App web responsivo em português com agendamentos, gestão de clientes, serviços, profissionais, agenda da equipe e indicadores. Mantém HTML, CSS e JavaScript puro, sem framework, build ou dependências de execução.

**Modo demonstração local:** dados apenas no navegador/origem. Não há backend, login da equipe, cobrança, sincronização entre dispositivos ou reserva em uma barbearia real. A interface informa essa condição em todas as telas. Não use como única fonte de dados de uma operação real.

## Executar

Com Python 3:

```sh
python3 -m http.server 8000 --directory dist
```

Abra **http://localhost:8000**. Use um servidor HTTP: os módulos JavaScript não funcionam corretamente abrindo `index.html` por `file://`. A pasta `dist` pode ser publicada em qualquer hospedagem estática com suporte a módulos JavaScript.

O app funciona sem Node e sem instalar pacotes. Google Fonts e a fotografia de apresentação dependem de internet; fontes locais e um fundo de cor são usados quando indisponíveis. Não há analytics. O navegador precisa oferecer módulos ES, `dialog` e `structuredClone` (versões atuais de Chrome, Edge, Firefox e Safari).

## O que está implementado

### Agendamentos

- Fluxo com serviço, preço, duração, profissional, data, horários válidos, cliente e resumo antes de confirmar.
- Cadastro de cliente no próprio formulário, salvo na mesma transação da reserva; falha na reserva não deixa um cliente parcial.
- Referências `clientId`, `serviceId`, `barberId`; UUID, código da reserva, observações e datas de criação/atualização.
- Edição e remarcação: cliente, serviço, profissional, data e horário.
- Status aguardando, confirmado, concluído, cancelado e faltou. Conclusão/falta apenas a partir do início do atendimento.
- Cancelamento com confirmação e motivo, mantendo histórico; desfazer revalida horário futuro e disponibilidade.
- Busca por cliente/telefone, filtros de status, profissional e período e ordenação cronológica.
- Preço em centavos, duração, intervalo e comissão registrados na reserva. Edições no catálogo não alteram reservas anteriores; trocar o serviço na reserva atualiza os valores aplicáveis.
- Conflitos por sobreposição de intervalos, considerando serviço, intervalo adicional, almoço, expediente, folgas, férias, bloqueios e outras reservas do profissional.
- Comparações no horário de Brasília, independentes do fuso configurado no dispositivo.

### Clientes

- Cadastro, busca, edição, telefone brasileiro normalizado, e-mail e aniversário validado.
- Observações, preferências, tags e consentimento explícito para mensagens.
- Vínculo das reservas preservado após mudar nome ou telefone.
- Histórico completo, visitas concluídas, último/próximo atendimento, total gasto, serviço mais utilizado e profissional preferido.
- Exclusão confirmada de cadastros sem reservas; com histórico, arquivamento. Arquivados podem ser localizados e reativados pela edição.
- Copiar telefone, abrir WhatsApp e convite para retorno mediante consentimento.

### Serviços, profissionais e agenda

- Cadastro/edição de serviços, descrição, categoria, ordem, preço, promoção, duração, intervalo e combos de serviços individuais. Arquivamento pelo estado inativo.
- Cadastro/edição de profissionais com avatar por iniciais, especialidades, estado ativo, dias de trabalho, almoço, férias e comissão percentual.
- Bloqueios manuais com motivo, removíveis e sem sobrepor reservas existentes.
- Agenda diária, semanal e mensal agrupada por dia, filtros de profissional/status/serviço, horários livres clicáveis, ocupação e acesso às ações de cada reserva. Sem drag and drop.
- Reservas do dia, atrasadas e faltas identificadas por texto, além de cor.
- Mudar expediente ou desativar profissional/serviço não cancela reservas já existentes. Revise a agenda após essas alterações.

### Indicadores e diferenciais locais

- Hoje: reservas, previsto (aguardando + confirmados + concluídos), receita concluída, atendimentos concluídos, cancelamentos, faltas, clientes novos, ocupação e ticket médio.
- Próximos atendimentos, serviços mais utilizados, profissional com mais visitas concluídas e clientes sem retorno em 30–59, 60–89 ou 90+ dias.
- Ocupação = união de reservas e bloqueios dentro do expediente, descontando almoço. Não soma intervalos sobrepostos duas vezes. Não depende do filtro de status/serviço; o filtro de profissional e período define a capacidade.
- Comissão estimada sobre concluídos de hoje, arredondada por reserva. Não registra pagamento.
- Cartão fidelidade **informativo**: 10 pontos por visita concluída e ciclo de 10 carimbos. Sem resgate, descontos ou movimentação financeira.

### WhatsApp

Funções centralizadas geram textos de confirmação, lembrete, cancelamento, reagendamento, avaliação/pós-atendimento e convite de retorno. Os botões abrem `wa.me` com texto para **a pessoa revisar e enviar**. Não há envio automático, agendador de mensagens ou afirmação de mensagem enviada. É necessário telefone válido e consentimento registrado. Não há link externo real de avaliação configurado.

## Dados locais, migração e recuperação

O adapter em `dist/modules/storage.js` é o único código que acessa `localStorage`. O estado versionado está em `brava-v2`; uma cópia anterior é guardada em `brava-v2-backup`. Operações de repositório validam o estado e os dados antes de gravar. Falha de leitura, corrupção, falta de espaço ou acesso negado apresenta erro, sem confirmar um salvamento inexistente.

A primeira abertura migra as chaves antigas `brava-clients` e `brava-bookings` sem apagá-las. Nomes únicos recuperam o vínculo; nomes ambíguos ou alterados geram contatos separados com aviso de revisão. Não há como recuperar com certeza relações que o protótipo não armazenava. Consentimento antigo não é presumido. Revisões estão em **Dados e privacidade**. Dados legados inválidos interrompem a migração e podem ser exportados para recuperação.

Em **Dados e privacidade**:

- **Exportar backup JSON:** baixa dados atuais, cópia anterior e chaves legadas. Contém dados pessoais; proteja o arquivo. Não há importador arbitrário de JSON nesta versão.
- **Restaurar backup anterior:** repõe a última cópia local válida. Exporte antes de usar.
- **Limpar dados locais:** remove clientes/reservas e volta ao catálogo/equipe padrão. Guarda uma cópia anterior para recuperação e remove as chaves legadas.
- **Restaurar demonstração:** substitui os dados por catálogo/equipe padrão e um contato/atendimento explicitamente fictício, sem telefone ou e-mail real.
- **Apagar tudo definitivamente:** remove as quatro chaves do app, incluindo backups e legado; inicializa depois um catálogo vazio de clientes e reservas. Não remove dados de outros apps. Não pode ser desfeito.

O backup é de uma versão anterior, não um histórico ilimitado. Novas operações podem substituí-lo. Limpar dados do navegador, mudar a origem/porta ou usar outro dispositivo não transfere os registros.

Formulários usam revisão otimista por `updatedAt`; gravações cooperam por Web Locks quando disponível, relendo o estado antes de gravar. Isso reduz conflitos entre abas deste app, mas **não substitui transações e restrições no servidor**. Não há isolamento contra edição manual do armazenamento ou garantia multiusuário.

## Testes

Node 20+ para testes de domínio, sem instalar pacotes:

```sh
npm test
```

Para os testes de navegador (dependência apenas de desenvolvimento):

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Ou use um Chromium existente:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

O teste de navegador abre seu próprio servidor temporário, usa contextos isolados e dados fictícios; não altera dados do app publicado. Os testes cobrem validações, referências e snapshots, migração, conflitos, domingo/horários passados, almoço/férias/bloqueios, cancelamento/remarcação, arquivamento, persistência, erros de armazenamento, escape de HTML, navegação, teclado e layout móvel. Veja [docs/VALIDATION.md](docs/VALIDATION.md).

## Estrutura

```text
dist/
  index.html                 Estrutura e navegação
  styles.css                 Identidade BRAVA e regras responsivas
  app.js                     Inicialização, composição e ações
  modules/
    config.js                Catálogo inicial, status e configuração
    utils.js                 Datas, valores monetários, IDs e escape
    storage.js               Adapter local, schema, migração e recuperação
    repository.js            API de dados e validações nas mutações
    bookings.js              Regras puras de disponibilidade e ocupação
    clients.js               Validação e estatísticas de clientes
    services.js              Validação de serviços e profissionais
    ui.js                    Formulários, diálogo e feedback acessível
    booking-view.js          Fluxo e lista de reservas
    client-view.js           Gestão e histórico de clientes
    catalog-view.js          Gestão de catálogo, equipe e bloqueios
    admin-view.js            Agenda e indicadores
tests/                       Testes de domínio e navegador
docs/                        Arquitetura, validação e próximos passos
```

## Backend e próximos passos

Não há credenciais ou backend configurado. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) descreve o contrato de repositório, entidades, estratégia de migração e requisitos para uma API/Supabase real. Autenticação, controle de acesso por barbearia, validação no servidor, prevenção transacional de sobreposição e backups externos são pré-requisitos para produção.

A lista de espera, campanhas automáticas, assinaturas, cupons, estoque, avaliações armazenadas, fotos autorizadas, pagamentos e integrações Instagram/Google Business Profile **não estão implementados**. O roadmap em [docs/ROADMAP.md](docs/ROADMAP.md) separa essas próximas etapas das funções entregues.

Versão hospedada (acesso privado, independente da visibilidade do repositório):
https://barbearia-brava-studio.furryswordfish2.chatgpt.site
