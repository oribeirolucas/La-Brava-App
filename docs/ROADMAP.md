# Próximas etapas

## Entregue nesta versão

P0: entidades com ID, reserva vinculada, migração e adapter local, edição/remarcação, status, histórico de cancelamento, validação, conflitos e feedback. P1: agenda em três períodos, catálogo, equipe/horários, histórico e filtros, dashboard e abertura manual do WhatsApp. P2 limitado a pontos/carimbos informativos, preferências e estimativa de comissão. Esses cálculos não geram recompensas nem cobranças.

## Antes de uso operacional

1. Backend autenticado por barbearia, restrições de conflito no banco e backups externos.
2. Importação assistida dos dados locais; revisar clientes homônimos/renomeados recuperados do legado.
3. Papéis e permissões, retenção/LGPD, contatos da barbearia e documentos de privacidade específicos.
4. Revisar catálogo, equipe, preços, agenda e regras de comissão com a barbearia real.

## Diferenciais futuros — não implementados

| Recurso                             | Dados / infraestrutura necessários                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista de espera                     | Cliente, serviço, profissional opcional, janelas aceitas e status; servidor aloca com expiração e confirmação, sem ocupar vaga automaticamente sem autorização. |
| Fidelidade com resgate              | Livro de movimentações imutável, regras de expiração/resgate e reversão após cancelar atendimento. Não usar apenas um total editável.                           |
| Indicações e cupons                 | Códigos, limites por cliente/período, elegibilidade, uso atômico e auditoria de desconto em centavos.                                                           |
| Clube, pacotes e assinaturas        | Produtos, direitos por período, consumo, recorrência, provedor de pagamentos e webhooks idempotentes.                                                           |
| Lembretes e campanhas               | Opt-in verificável, templates, fila/outbox, fuso, agendador, WhatsApp Business e rastreamento real de entrega.                                                  |
| Avaliação e NPS                     | Token opaco com prazo, consentimento, resposta vinculada e regras antiabuso. O botão atual só solicita opinião em texto.                                        |
| Fotos de cortes                     | Armazenamento privado, limites, consentimento específico, acesso temporário e política de exclusão.                                                             |
| Produtos e estoque                  | Produtos/SKUs, venda, itens, livro de movimentações, devoluções e ajustes auditados.                                                                            |
| Comissão operacional                | Regras por serviço, competência, estornos, aprovação e liquidação. A estimativa atual não controla pagamentos.                                                  |
| Relatórios avançados                | Consultas agregadas no servidor, períodos comparáveis, exportação e reconciliação financeira.                                                                   |
| Instagram / Google Business Profile | Aplicativos aprovados, OAuth, escopos, credenciais no servidor e testes de autorização.                                                                         |
| Link público e QR Code              | Endpoint público de disponibilidade isolado do painel, autenticação apropriada para cancelamentos e proteção contra coleta de dados e spam.                     |

A interface não oferece botões fictícios para esses recursos. A separação entre repositório, regras e telas permite acrescentá-los sem misturar persistência à UI.
