const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataPath = path.join(__dirname, 'vendas.json');
const inventoryPath = path.join(__dirname, 'estoque.json');
const movementsPath = path.join(__dirname, 'movimentacoes.json');

app.use(express.json());

function readJson(filePath, key) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data[key])) {
    throw new Error(`O arquivo precisa conter uma lista "${key}".`);
  }
  return data;
}

function saveJson(filePath, key, entries) {
  fs.writeFileSync(filePath, `${JSON.stringify({ [key]: entries }, null, 2)}\n`, 'utf8');
}

app.get('/api/estoque', (_request, response) => {
  try {
    const inventory = readJson(inventoryPath, 'estoque').estoque;
    response.json({ produtos: inventory });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/movimentacoes', (_request, response) => {
  try {
    const movements = readJson(movementsPath, 'movimentacoes').movimentacoes;
    response.json({ movimentacoes: movements });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/movimentacoes', (request, response) => {
  try {
    const { codigoProduto, tipo, quantidade, descricao } = request.body;
    const productCode = Number(codigoProduto);
    const amount = Number(quantidade);
    if (!Number.isInteger(productCode)) {
      return response.status(400).json({ message: 'Selecione um produto válido.' });
    }
    if (!['entrada', 'saida'].includes(tipo)) {
      return response.status(400).json({ message: 'O tipo deve ser entrada ou saída.' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return response.status(400).json({ message: 'A quantidade deve ser um número inteiro maior que zero.' });
    }
    if (typeof descricao !== 'string' || !descricao.trim()) {
      return response.status(400).json({ message: 'Informe uma descrição para a movimentação.' });
    }

    const inventoryData = readJson(inventoryPath, 'estoque');
    const product = inventoryData.estoque.find((item) => item.codigoProduto === productCode);
    if (!product) {
      return response.status(404).json({ message: 'O produto selecionado não existe no estoque.' });
    }
    const nextStock = product.estoque + (tipo === 'entrada' ? amount : -amount);
    if (nextStock < 0) {
      return response.status(409).json({ message: `Estoque insuficiente. Disponível: ${product.estoque} unidades.` });
    }

    const movements = readJson(movementsPath, 'movimentacoes').movimentacoes;
    const id = movements.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;
    const movement = {
      id,
      codigoProduto: product.codigoProduto,
      descricaoProduto: product.descricaoProduto,
      tipo,
      descricao: descricao.trim(),
      quantidade: amount,
      estoqueFinal: nextStock,
      data: new Date().toISOString(),
    };

    product.estoque = nextStock;
    saveJson(inventoryPath, 'estoque', inventoryData.estoque);
    saveJson(movementsPath, 'movimentacoes', [...movements, movement]);
    return response.status(201).json({ movimentacao: movement });
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
});

app.post('/api/juros', (request, response) => {
  const amount = Number(request.body.valor);
  const dueDate = request.body.dataVencimento;
  if (!Number.isFinite(amount) || amount <= 0) {
    return response.status(400).json({ message: 'Informe um valor maior que zero.' });
  }
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return response.status(400).json({ message: 'Informe uma data de vencimento válida.' });
  }

  const [year, month, day] = dueDate.split('-').map(Number);
  const dueDay = Date.UTC(year, month - 1, day);
  const validatedDate = new Date(dueDay);
  if (validatedDate.getUTCFullYear() !== year || validatedDate.getUTCMonth() !== month - 1 || validatedDate.getUTCDate() !== day) {
    return response.status(400).json({ message: 'Informe uma data de vencimento válida.' });
  }

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diasAtraso = Math.max(0, Math.floor((today - dueDay) / 86400000));
  const valorCentavos = Math.round(amount * 100);
  const jurosCentavos = Math.round(valorCentavos * 0.025 * diasAtraso);
  return response.json({
    valorOriginal: valorCentavos / 100,
    dataVencimento: dueDate,
    diasAtraso,
    taxaDiaria: 2.5,
    valorJuros: jurosCentavos / 100,
    valorTotal: (valorCentavos + jurosCentavos) / 100,
    criterio: 'juros simples: 2,5% ao dia sobre o valor original',
  });
});

function readSales() {
  const file = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(file);
  if (!Array.isArray(data.vendas)) {
    throw new Error('O arquivo de vendas precisa conter uma lista "vendas".');
  }
  return data.vendas;
}

function calculateCommission(value) {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error(`Valor de venda inválido: ${value}`);
  }
  if (cents < 10000) return { rate: 0, commission: 0 };
  if (cents < 50000) return { rate: 1, commission: Math.round(cents * 0.01) / 100 };
  return { rate: 5, commission: Math.round(cents * 0.05) / 100 };
}

app.get('/api/vendas', (_request, response) => {
  try {
    response.json({ vendas: readSales() });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/comissoes', (_request, response) => {
  try {
    const sales = readSales();
    const grouped = new Map();

    for (const sale of sales) {
      if (typeof sale.vendedor !== 'string' || !sale.vendedor.trim()) {
        throw new Error('Cada venda precisa informar um vendedor.');
      }
      const value = Number(sale.valor);
      const { rate, commission } = calculateCommission(value);
      const seller = grouped.get(sale.vendedor) ?? {
        vendedor: sale.vendedor,
        totalVendido: 0,
        totalComissao: 0,
        quantidadeVendas: 0,
        vendas: [],
      };

      seller.totalVendido = Math.round((seller.totalVendido + value) * 100) / 100;
      seller.totalComissao = Math.round((seller.totalComissao + commission) * 100) / 100;
      seller.quantidadeVendas += 1;
      seller.vendas.push({ valor: value, percentual: rate, comissao: commission });
      grouped.set(sale.vendedor, seller);
    }

    const vendedores = [...grouped.values()].sort((a, b) => b.totalComissao - a.totalComissao);
    const totalVendido = Math.round(vendedores.reduce((sum, seller) => sum + seller.totalVendido, 0) * 100) / 100;
    const totalComissao = Math.round(vendedores.reduce((sum, seller) => sum + seller.totalComissao, 0) * 100) / 100;

    response.json({
      totalVendido,
      totalComissao,
      quantidadeVendas: sales.length,
      quantidadeVendedores: vendedores.length,
      vendedores,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`API de comissões disponível em http://localhost:${port}`);
});
