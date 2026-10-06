# Instruções do projeto

- Aplicação full-stack comercial: comissões, movimentação de estoque e cálculo de juros, com Angular na interface e Node.js/Express na API.
- Mantenha a interface e as mensagens em português brasileiro e use valores monetários em BRL.
- Regra por venda: abaixo de R$ 100,00 = 0%; de R$ 100,00 até abaixo de R$ 500,00 = 1%; R$ 500,00 ou mais = 5%.
- A fonte de dados local é `server/vendas.json`; a API deve ser executada na porta 3000.
- O estoque e as movimentações persistem em `server/estoque.json` e `server/movimentacoes.json`.
- A calculadora considera juros simples de 2,5% ao dia sobre o valor original após o vencimento.
- Antes de concluir alterações, valide a compilação Angular e a API.

## Configuração
- [x] Requisitos esclarecidos
- [x] Projeto Angular inicializado
- [x] Aplicação personalizada e validada
- [x] Documentação revisada
