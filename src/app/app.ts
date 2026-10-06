import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface InventoryProduct {
  codigoProduto: number;
  descricaoProduto: string;
  estoque: number;
}

interface StockMovement {
  id: number;
  codigoProduto: number;
  descricaoProduto: string;
  tipo: 'entrada' | 'saida';
  descricao: string;
  quantidade: number;
  estoqueFinal: number;
  data: string;
}

interface LateFeeResult {
  valorOriginal: number;
  dataVencimento: string;
  diasAtraso: number;
  taxaDiaria: number;
  valorJuros: number;
  valorTotal: number;
  criterio: string;
}

interface SaleDetail {
  valor: number;
  percentual: number;
  comissao: number;
}

interface SellerSummary {
  vendedor: string;
  totalVendido: number;
  totalComissao: number;
  quantidadeVendas: number;
  vendas: SaleDetail[];
}

interface CommissionReport {
  totalVendido: number;
  totalComissao: number;
  quantidadeVendas: number;
  quantidadeVendedores: number;
  vendedores: SellerSummary[];
}

@Component({
  imports: [DatePipe],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './dashboard.html',
})
export class App {
  private readonly http = inject(HttpClient);
  protected readonly report = signal<CommissionReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly expandedSeller = signal('');
  protected readonly page = signal<'comissoes' | 'estoque' | 'juros'>('comissoes');
  protected readonly products = signal<InventoryProduct[]>([]);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly inventoryError = signal('');
  protected readonly movementProduct = signal('');
  protected readonly movementType = signal<'entrada' | 'saida'>('entrada');
  protected readonly movementQuantity = signal('1');
  protected readonly movementDescription = signal('');
  protected readonly savingMovement = signal(false);
  protected readonly lastMovement = signal<StockMovement | null>(null);
  protected readonly interestAmount = signal('');
  protected readonly dueDate = signal('');
  protected readonly feeResult = signal<LateFeeResult | null>(null);
  protected readonly interestError = signal('');
  protected readonly calculatingFee = signal(false);

  protected readonly recentMovements = computed(() => [...this.movements()].reverse());

  protected readonly filteredSellers = computed(() => {
    const sellers = this.report()?.vendedores ?? [];
    const query = this.search().trim().toLocaleLowerCase('pt-BR');
    return sellers.filter((seller) => seller.vendedor.toLocaleLowerCase('pt-BR').includes(query));
  });

  constructor() {
    this.loadReport();
    this.loadInventory();
  }

  protected pageTitle(): string {
    return this.page() === 'estoque' ? 'Estoque' : this.page() === 'juros' ? 'Calculadora de juros' : 'Comissões';
  }

  protected setPage(page: 'comissoes' | 'estoque' | 'juros'): void {
    this.page.set(page);
    this.lastMovement.set(null);
  }

  protected loadInventory(): void {
    this.inventoryError.set('');
    this.http.get<{ produtos: InventoryProduct[] }>('/api/estoque').subscribe({
      next: ({ produtos }) => this.products.set(produtos),
      error: () => this.inventoryError.set('A API de estoque não respondeu.'),
    });
    this.http.get<{ movimentacoes: StockMovement[] }>('/api/movimentacoes').subscribe({
      next: ({ movimentacoes }) => this.movements.set(movimentacoes),
      error: () => this.inventoryError.set('Não foi possível carregar o histórico de movimentações.'),
    });
  }

  protected setMovementProduct(event: Event): void {
    this.movementProduct.set((event.target as HTMLSelectElement).value);
  }

  protected setMovementType(event: Event): void {
    this.movementType.set((event.target as HTMLSelectElement).value as 'entrada' | 'saida');
  }

  protected setMovementQuantity(event: Event): void {
    this.movementQuantity.set((event.target as HTMLInputElement).value);
  }

  protected setMovementDescription(event: Event): void {
    this.movementDescription.set((event.target as HTMLInputElement).value);
  }

  protected submitMovement(event: Event): void {
    event.preventDefault();
    this.inventoryError.set('');
    this.lastMovement.set(null);
    this.savingMovement.set(true);
    this.http.post<{ movimentacao: StockMovement }>('/api/movimentacoes', {
      codigoProduto: Number(this.movementProduct()),
      tipo: this.movementType(),
      quantidade: Number(this.movementQuantity()),
      descricao: this.movementDescription(),
    }).subscribe({
      next: ({ movimentacao }) => {
        this.lastMovement.set(movimentacao);
        this.movementDescription.set('');
        this.loadInventory();
        this.savingMovement.set(false);
      },
      error: (error: { error?: { message?: string } }) => {
        this.inventoryError.set(error.error?.message ?? 'Não foi possível registrar a movimentação.');
        this.savingMovement.set(false);
      },
    });
  }

  protected setInterestAmount(event: Event): void {
    this.interestAmount.set((event.target as HTMLInputElement).value);
    this.feeResult.set(null);
  }

  protected setDueDate(event: Event): void {
    this.dueDate.set((event.target as HTMLInputElement).value);
    this.feeResult.set(null);
  }

  protected calculateLateFee(event: Event): void {
    event.preventDefault();
    this.interestError.set('');
    this.feeResult.set(null);
    this.calculatingFee.set(true);
    this.http.post<LateFeeResult>('/api/juros', {
      valor: Number(this.interestAmount()),
      dataVencimento: this.dueDate(),
    }).subscribe({
      next: (result) => {
        this.feeResult.set(result);
        this.calculatingFee.set(false);
      },
      error: (error: { error?: { message?: string } }) => {
        this.interestError.set(error.error?.message ?? 'Não foi possível calcular o valor atualizado.');
        this.calculatingFee.set(false);
      },
    });
  }

  protected todayLabel(): string {
    return new Intl.DateTimeFormat('pt-BR').format(new Date());
  }

  protected loadReport(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<CommissionReport>('/api/comissoes').subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('A API não respondeu.');
        this.loading.set(false);
      },
    });
  }

  protected totalCommission(): number {
    return this.report()?.totalComissao ?? 0;
  }

  protected totalSold(): number {
    return this.report()?.totalVendido ?? 0;
  }

  protected quantitySales(): number {
    return this.report()?.quantidadeVendas ?? 0;
  }

  protected currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toLocaleUpperCase('pt-BR');
  }

  protected averageCommission(seller: SellerSummary): number {
    return seller.quantidadeVendas ? seller.totalComissao / seller.quantidadeVendas : 0;
  }

  protected progress(commission: number): number {
    const max = Math.max(
      ...(this.report()?.vendedores.map((seller) => seller.totalComissao) ?? [1]),
    );
    return max ? Math.max(6, (commission / max) * 100) : 0;
  }

  protected toggleSeller(name: string): void {
    this.expandedSeller.update((current) => (current === name ? '' : name));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected exportCsv(): void {
    const sellers = this.filteredSellers();
    const rows = [
      ['Vendedor', 'Total vendido', 'Quantidade de vendas', 'Comissão total'],
      ...sellers.map((seller) => [
        seller.vendedor,
        seller.totalVendido.toFixed(2),
        String(seller.quantidadeVendas),
        seller.totalComissao.toFixed(2),
      ]),
    ];
    const csv =
      '\uFEFF' +
      rows
        .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';'))
        .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'relatorio-comissoes.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
