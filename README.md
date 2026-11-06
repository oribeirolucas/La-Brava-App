# BRAVA — Barbearia

App web responsivo em português para uma barbearia, desenvolvido com HTML, CSS e JavaScript, sem etapa de compilação ou dependências de execução.

## Funcionalidades

- Catálogo de serviços com preços e duração.
- Escolha de profissional, data e horário para agendamento.
- Consulta e cancelamento de agendamentos.
- Cadastro de clientes com nome, telefone, e-mail e data de nascimento.
- Busca, edição, exclusão e validação de telefone duplicado.
- Seleção de cliente cadastrado no agendamento.

## Executar localmente

Com Python 3 instalado, execute na raiz do projeto:

```sh
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000 no navegador.

## Estrutura

- `dist/index.html`: interface, estilos e fluxo de agendamento.
- `dist/clients.js`: cadastro de clientes e integração com agendamentos.

Para hospedagem estática, publique a pasta `dist`.

## Persistência e limites

Clientes e agendamentos ficam no `localStorage` do navegador. Não há backend, autenticação própria, sincronização entre dispositivos ou envio de reservas a uma barbearia real. Os horários refletem apenas reservas feitas no mesmo navegador. Limpar os dados do site remove esses registros.

Nome, profissionais, preços e avaliações são conteúdo de demonstração. Fontes e fotografias usam Google Fonts e Unsplash e dependem de conexão com a internet.

## Versão hospedada

https://barbearia-brava-studio.furryswordfish2.chatgpt.site

O acesso à versão hospedada é privado e independente da visibilidade deste repositório.
