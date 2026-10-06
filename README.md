# Painel Comercial, Estoque e Juros

Aplicação full-stack em Node.js/Express e Angular com painel de comissões, controle de movimentações de estoque e calculadora de multa por atraso. A interface é responsiva e toda em português brasileiro.

## Regra de comissão

A taxa é aplicada individualmente a cada venda:

| Valor da venda | Comissão |
| --- | ---: |
| Abaixo de R$ 100,00 | 0% |
| De R$ 100,00 até abaixo de R$ 500,00 | 1% |
| R$ 500,00 ou mais | 5% |

Os limites de R$ 100,00 e R$ 500,00 pertencem às faixas de 1% e 5%, respectivamente. Os valores monetários são arredondados para centavos.

## Requisitos

- Node.js 20.19+ ou 22.12+ e npm.

## Instalação e execução

Na raiz do projeto, instale as dependências e inicie a API e a interface:

```bash
npm install
npm start
```

A interface ficará em `http://localhost:4200` e a API em `http://localhost:3000`. O proxy do servidor de desenvolvimento Angular encaminha `/api` para o backend.

Para iniciar apenas a API, execute `npm run start:api`. Para gerar a versão de produção da interface, execute `npm run build`.

## Dados e endpoints

As vendas de exemplo ficam em `server/vendas.json`; edite esse arquivo para atualizar os registros.

- `GET /api/vendas`: retorna a lista de vendas carregada do JSON.
- `GET /api/comissoes`: retorna os totais gerais e o resumo por vendedor, incluindo comissão calculada para cada venda.

O backend valida os vendedores e valores recebidos e calcula as taxas em centavos para reduzir erros de precisão monetária.

## Controle de estoque

O saldo inicial dos cinco produtos fica em `server/estoque.json`. Pela opção **Estoque**, registre entradas ou saídas com produto, quantidade e descrição. Cada registro recebe um identificador numérico único e informa o saldo final. Os dados do estoque e do histórico são persistidos, respectivamente, em `server/estoque.json` e `server/movimentacoes.json`. Saídas acima do saldo disponível são rejeitadas.

- `GET /api/estoque`: lista produtos e saldos atuais.
- `GET /api/movimentacoes`: consulta o histórico de movimentações.
- `POST /api/movimentacoes`: registra entrada ou saída. Corpo JSON: `codigoProduto`, `tipo` (`entrada` ou `saida`), `quantidade` (inteiro positivo) e `descricao`.

## Multa por atraso

Na opção **Calculadora de juros**, informe o valor original e a data de vencimento. A multa usa juros simples de 2,5% do valor original por dia corrido de atraso; antes ou no dia do vencimento, o atraso e a multa são zero. O cálculo retorna o valor original, dias em atraso, multa acumulada e total atualizado.

- `POST /api/juros`: corpo JSON com `valor` e `dataVencimento` no formato `AAAA-MM-DD`.
