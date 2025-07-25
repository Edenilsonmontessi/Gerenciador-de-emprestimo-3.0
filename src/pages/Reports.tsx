import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { useLocalData } from '../contexts/SupabaseContext';
import { getLoanStatus } from '../utils/loanStatus';
import { ReportFilter } from '../types';

export default function Reports() {
  const { loans, receipts, clients, updateLoan, payments } = useLocalData();
  // Recalcula e atualiza o status de todos os empréstimos ao abrir a tela de relatórios
  useEffect(() => {
    loans.forEach(async (loan) => {
      let newStatus = loan.status;
      const today = new Date();
      const dueDate = new Date(loan.dueDate);
      const recibosDoEmprestimo = receipts.filter(r => r.loanId === loan.id);
      const totalPagoRecibos = recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0);
      // Considera inadimplente qualquer empréstimo vencido e não quitado, independente da modalidade
      const hasQuitacao = payments.filter(p => p.loanId === loan.id).some(p => p.type === 'full');
      const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
      const recibosPagos = receipts.filter(r => r.loanId === loan.id).length;
      const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
      const hasFullPayment = pagamentosDoEmprestimo.some(p => p.type === 'full' && p.amount >= loan.totalAmount);
      if (hasQuitacao || hasFullPayment || (totalParcelas > 0 && recibosPagos >= totalParcelas) || (loan.paymentType !== 'diario' && totalPagoRecibos >= loan.totalAmount)) {
        newStatus = 'completed';
      } else if (today > dueDate) {
        newStatus = 'defaulted';
      } else {
        newStatus = 'active';
      }
      if (newStatus !== loan.status) {
        await updateLoan(loan.id, { status: newStatus });
      }
    });
  }, [loans, receipts, payments, updateLoan]);
  const [filter, setFilter] = useState<ReportFilter>({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  
  const [loanData, setLoanData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  
  // Apply filters to calculations
  useEffect(() => {
    const filteredLoans = loans.filter(loan => {
      const loanDate = new Date(loan.createdAt);
      const startDate = filter.startDate ? new Date(filter.startDate) : null;
      const endDate = filter.endDate ? new Date(filter.endDate) : null;
      
      let matchesFilter = true;
      
      if (startDate && loanDate < startDate) matchesFilter = false;
      if (endDate) {
        const endWithDay = new Date(endDate);
        endWithDay.setHours(23, 59, 59, 999);
        if (loanDate > endWithDay) matchesFilter = false;
      }
      
      if (filter.clientId && loan.clientId !== filter.clientId) matchesFilter = false;
      if (filter.status && loan.status !== filter.status) matchesFilter = false;
      
      return matchesFilter;
    });
    
    // Group loans by month for chart
    const loansByMonth: Record<string, { month: string, count: number, amount: number }> = {};
    
    filteredLoans.forEach(loan => {
      const date = new Date(loan.createdAt);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      
      if (!loansByMonth[monthYear]) {
        loansByMonth[monthYear] = {
          month: monthYear,
          count: 0,
          amount: 0
        };
      }
      
      loansByMonth[monthYear].count += 1;
      loansByMonth[monthYear].amount += loan.amount;
    });
    
    setLoanData(Object.values(loansByMonth));
    
    // Filter and group payments by month
    const filteredReceipts = receipts.filter(receipt => {
      const receiptDate = new Date(receipt.date);
      const startDate = filter.startDate ? new Date(filter.startDate) : null;
      const endDate = filter.endDate ? new Date(filter.endDate) : null;
      
      let matchesFilter = true;
      
      if (startDate && receiptDate < startDate) matchesFilter = false;
      if (endDate) {
        const endWithDay = new Date(endDate);
        endWithDay.setHours(23, 59, 59, 999);
        if (receiptDate > endWithDay) matchesFilter = false;
      }
      
      if (filter.clientId && receipt.clientId !== filter.clientId) matchesFilter = false;
      
      return matchesFilter;
    });
    
    const paymentsByMonth: Record<string, { month: string, count: number, amount: number }> = {};
    
    filteredReceipts.forEach(receipt => {
      const date = new Date(receipt.date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      
      if (!paymentsByMonth[monthYear]) {
        paymentsByMonth[monthYear] = {
          month: monthYear,
          count: 0,
          amount: 0
        };
      }
      
      paymentsByMonth[monthYear].count += 1;
      paymentsByMonth[monthYear].amount += receipt.amount;
    });
    
    setPaymentData(Object.values(paymentsByMonth));
    
  }, [loans, receipts, filter]);
  
  // Calculate summary data
  // Agora soma apenas o valor realmente emprestado (campo amount)
  const totalLoaned = loans.reduce((sum, loan) => {
    const value = Number(loan.amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  // Calcula o total recebido igual ao Dashboard (soma todos os recibos gerados)
  const totalReceived = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  // Calcula o saldo a receber usando getLoanStatus igual ao Dashboard
  const pendingAmount = loans.reduce((sum, loan) => {
    const status = getLoanStatus(loan, receipts, loan.payments || []);
    if (status === 'active' || status === 'defaulted') {
      // Replicar cálculo do Dashboard
      const recibosDoEmprestimo = receipts.filter(r => r.loanId === loan.id);
      const totalPago = recibosDoEmprestimo.reduce((s, r) => s + (r.amount || 0), 0);
      if (loan.paymentType === 'interest_only') {
        const hasFull = loan.payments && loan.payments.some(p => p.type === 'full');
        return sum + (hasFull ? 0 : loan.totalAmount - totalPago);
      } else if (loan.paymentType === 'diario') {
        const hasFull = loan.payments && loan.payments.some(p => p.type === 'full');
        const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
        const valorParcela = loan.installmentAmount || 0;
        const saldo = hasFull ? 0 : Math.max((totalParcelas * valorParcela) - totalPago, 0);
        return sum + saldo;
      } else {
        const saldo = loan.totalAmount - totalPago;
        return sum + (saldo > 0 ? saldo : 0);
      }
    }
    return sum;
  }, 0);

  // Contagem igual ao Dashboard
  const activeLoans = loans.filter(loan => loan.status === 'active' || loan.status === 'defaulted').length;
  const completedLoans = loans.filter(loan => loan.status === 'completed').length;
  const defaultedLoans = loans.filter(loan => loan.status === 'defaulted').length;
  
  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-600">Análise de desempenho financeiro</p>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-indigo-600 mr-2" />
          <h2 className="text-lg font-medium text-gray-900">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label" htmlFor="startDate">Data Inicial</label>
            <input 
              type="date" 
              id="startDate"
              name="startDate"
              className="form-input"
              value={filter.startDate} 
              onChange={handleFilterChange}
            />
          </div>
          
          <div>
            <label className="form-label" htmlFor="endDate">Data Final</label>
            <input 
              type="date" 
              id="endDate"
              name="endDate"
              className="form-input"
              value={filter.endDate} 
              onChange={handleFilterChange}
            />
          </div>
          
          <div>
            <label className="form-label" htmlFor="clientId">Cliente</label>
            <select 
              id="clientId"
              name="clientId"
              className="form-input"
              value={filter.clientId || ''} 
              onChange={handleFilterChange}
            >
              <option value="">Todos os Clientes</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label" htmlFor="status">Status</label>
            <select 
              id="status"
              name="status"
              className="form-input"
              value={filter.status || ''} 
              onChange={handleFilterChange}
            >
              <option value="">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="completed">Concluídos</option>
              <option value="defaulted">Inadimplentes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Emprestado</p>
              <p className="text-2xl font-semibold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLoaned)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Recebido</p>
              <p className="text-2xl font-semibold text-blue-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceived)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <TrendingDown className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Saldo a Receber</p>
              <p className="text-2xl font-semibold text-purple-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingAmount)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>


      {/* ...nenhum relatório detalhado ou histórico de cliente... */}
      {/* Histórico de Empréstimos */}
      <div className="bg-white rounded-lg shadow p-6 mt-8 border border-indigo-100">
        <h2 className="text-lg font-bold text-indigo-700 mb-4">
          Histórico de Empréstimos {filter.clientId ? `do Cliente` : `de Todos os Clientes`}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-indigo-50">
                {!filter.clientId && (
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Cliente</th>
                )}
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Valor</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Recebido</th>

              </tr>
            </thead>
            <tbody>
              {loans
                .filter(loan => !filter.clientId || loan.clientId === filter.clientId)
                .map((loan, idx) => {
                  const client = clients.find(c => c.id === loan.clientId);
                  const recibosDoEmprestimo = receipts.filter(r => r.loanId === loan.id);
                  const totalRecebido = recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0);
                  let saldo = 0;
                  if (loan.paymentType === 'interest_only') {
                    const hasFull = loan.payments && loan.payments.some(p => p.type === 'full');
                    saldo = hasFull ? 0 : loan.totalAmount - totalRecebido;
                  } else if (loan.paymentType === 'diario') {
                    const hasFull = loan.payments && loan.payments.some(p => p.type === 'full');
                    const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
                    const valorParcela = loan.installmentAmount || 0;
                    saldo = hasFull ? 0 : Math.max((totalParcelas * valorParcela) - totalRecebido, 0);
                  } else {
                    saldo = loan.totalAmount - totalRecebido;
                  }
                  // Status igual ao detalhes do empréstimo
                  // Usar todos os pagamentos do contexto para garantir consistência com a tela de detalhes
                  const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
                  const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
                  let badgeClass = '';
                  let badgeText = '';
                  if (status === 'completed') {
                    badgeClass = 'badge-blue';
                    badgeText = 'Concluído';
                  } else if (status === 'overdue') {
                    badgeClass = 'badge-red';
                    badgeText = 'Atrasado';
                  } else {
                    badgeClass = 'badge-green';
                    badgeText = 'Ativo';
                  }
                  return (
                    <tr key={loan.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'}>
                      {!filter.clientId && (
                        <td className="px-4 py-2 text-sm text-gray-900">{client?.name || '-'}</td>
                      )}
                      <td className="px-4 py-2 text-sm text-gray-700">{new Date(loan.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2 text-sm text-indigo-700 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.amount)}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`badge ${badgeClass}`}>{badgeText}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-blue-700 font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecebido)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}