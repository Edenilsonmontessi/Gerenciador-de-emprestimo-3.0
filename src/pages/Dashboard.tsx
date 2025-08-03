import { Users, CreditCard, TrendingUp, Receipt, Plus } from 'lucide-react';
import StatCard from '../components/StatCard';
import { Link } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';
import { useMemo, useEffect } from 'react';
import { getLoanStatus } from '../utils/loanStatus';
// ...existing code...

export default function Dashboard() {
  const { clients, loans, receipts, refetchLoans, fixAllLoanStatuses } = useLocalData();
  // Refaz a busca dos empréstimos ao entrar na tela
  useEffect(() => {
    refetchLoans();
  }, [refetchLoans]);

  // Unifica cálculo igual ao Reports: soma recibos confirmados
  const stats = useMemo(() => {
    // Sempre calcula o status atualizado de cada empréstimo
    let activeOrOverdueLoans = 0;
    let overdueLoans = 0;
    let completedLoans = 0;
    loans.forEach(loan => {
      const status = getLoanStatus(loan, receipts, loan.payments || []);
      if (typeof window !== 'undefined' && window.console) {
        // ...existing code...
      }
      if (status === 'active' || status === 'overdue') activeOrOverdueLoans++;
      if (status === 'overdue') overdueLoans++;
      if (status === 'completed') completedLoans++;
    });
    const totalLoaned = loans.reduce((sum, loan) => sum + (loan.amount || 0), 0);

    // Total Recebido: soma todos os recibos e todos os pagamentos
    const totalRecebidoRecibos = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
    const totalRecebidoPagamentos = loans.flatMap(loan => (loan.payments || [])).reduce((sum, pagamento) => sum + (pagamento.amount || 0), 0);
    const totalReceived = totalRecebidoRecibos + totalRecebidoPagamentos;

    // Saldo a Receber: soma de todos os empréstimos não quitados
    const pendingAmount = loans
      .filter(loan => {
        const status = getLoanStatus(loan, receipts, loan.payments || []);
        return status !== 'completed';
      })
      .reduce((sum, loan) => {
        // Soma todos os valores recebidos (recibos e pagamentos) referentes ao empréstimo
        const totalRecebido = [
          ...receipts.filter((r) => r.loanId === loan.id).map(r => r.amount || 0),
          ...(loan.payments || []).filter((p) => p.loanId === loan.id).map(p => p.amount || 0)
        ].reduce((s, v) => s + v, 0);

        let totalComJuros = loan.totalAmount;
        if ((loan.paymentType === 'diario' || loan.paymentType === 'installments') && (loan.installments && loan.installmentAmount)) {
          totalComJuros = loan.installments * loan.installmentAmount;
        }
        const quitado = (loan.payments || []).some(p => p.type === 'full');
        const saldo = quitado ? 0 : Math.max(totalComJuros - totalRecebido, 0);
        return sum + saldo;
      }, 0);

    return {
      clientCount: clients.length,
      openLoans: activeOrOverdueLoans,
      completedLoans,
      overdueLoans,
      activeLoans: activeOrOverdueLoans,
      totalLoaned,
      totalReceived,
      pendingAmount,
    };
  }, [clients, loans, receipts]);

  return (
    <div className="p-2 md:p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-title">Dinheiro Rápido</h1>
        <p className="section-subtitle">Sistema de Controle de Empréstimos e Geração de Recibos</p>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid mb-8">
        <StatCard 
          title="Clientes" 
          value={stats.clientCount} 
          icon={<Users size={24} />} 
          to="/clients"
        />
        <StatCard 
          title="Empréstimos Ativos" 
          value={stats.activeLoans} 
          icon={<CreditCard size={24} />} 
          to="/loans"
          color="secondary"
          secondaryText={`Atrasados: ${stats.overdueLoans}`}
        />
        <StatCard 
          title="Total Emprestado" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalLoaned)} 
          icon={<TrendingUp size={24} />} 
          to="/reports"
          color="success"
        />
        <StatCard 
          title="Total Recebido" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceived)} 
          icon={<Receipt size={24} />} 
          to="/receipts"
          color="info"
        />
      </div>

      {/* Lista de empréstimos removida conforme solicitado */}

      {/* Financial Summary */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-subtitle mb-0">Resumo Financeiro</h2>
          <Link to="/reports" className="text-indigo-600 hover:text-indigo-800 text-sm">
            Ver relatórios completos
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total Emprestado</p>
            <p className="text-xl font-semibold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalLoaned)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Recebido</p>
            <p className="text-xl font-semibold text-blue-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceived)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Saldo a Receber</p>
            <p className="text-xl font-semibold text-purple-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.pendingAmount)}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="section-subtitle">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/clients/add" className="card flex items-center hover:shadow-xl transition-shadow">
            <div className="p-3 rounded-md bg-indigo-100 text-indigo-600 mr-4">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Novo Cliente</h3>
              <p className="text-sm text-gray-500">Cadastrar um novo cliente</p>
            </div>
          </Link>
          <Link to="/loans/add" className="card flex items-center hover:shadow-xl transition-shadow">
            <div className="p-3 rounded-md bg-green-100 text-green-600 mr-4">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Novo Empréstimo</h3>
              <p className="text-sm text-gray-500">Registrar um novo empréstimo</p>
            </div>
          </Link>
          <Link to="/receipts" className="card flex items-center hover:shadow-xl transition-shadow">
            <div className="p-3 rounded-md bg-blue-100 text-blue-600 mr-4">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Recibos</h3>
              <p className="text-sm text-gray-500">Visualizar todos os recibos</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}