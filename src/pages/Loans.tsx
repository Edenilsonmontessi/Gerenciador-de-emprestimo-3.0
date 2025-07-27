import dayjs from 'dayjs';
  // Função para saber se um empréstimo está inadimplente (vencido)
  function isOverdue(loan: any): boolean {
    if (loan.status !== 'active') return false;
    if (loan.paymentType === 'diario') {
      const start = loan.startDate ? dayjs(loan.startDate) : dayjs(loan.createdAt);
      const hoje = dayjs();
      const diasDecorridos = hoje.diff(start, 'day') + 1;
      const pagos = loan.payments ? loan.payments.length : 0;
      const total = loan.installments || loan.numberOfInstallments || 0;
      if (diasDecorridos > 0 && pagos === 0) return true;
      return pagos < Math.min(diasDecorridos, total);
    } else {
      const hoje = dayjs();
      return !!loan.dueDate && hoje.isAfter(dayjs(loan.dueDate));
    }
  }
import { useState } from 'react';
import { getLoanStatus } from '../utils/loanStatus';
import { getLoanStatusLabel } from '../utils/loanStatusLabel';
import { Receipt } from '../types';
import { Plus, Search, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';

export default function Loans() {
  const { loans, clients, payments, receipts, deleteLoanCascade } = useLocalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);

  // Get client name by ID
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente desconhecido';
  };

  // Adiciona os pagamentos em cada loan
  const loansWithPayments = loans.map(loan => {
    const loanPayments = payments.filter(p => p.loanId === loan.id);
    const loanReceipts = receipts ? receipts.filter((r: Receipt) => r.loanId === loan.id) : [];
    // Lógica para status visual: vencido se houver parcela vencida não paga
    let isOverdue = false;
    if (loan.status !== 'completed') {
      // Para parcelado/diário
      if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && (loan.installments || loan.numberOfInstallments)) {
        const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
        for (let i = 1; i <= totalParcelas; i++) {
          const dataBase = loan.startDate ? dayjs(loan.startDate) : dayjs(loan.createdAt);
          let dataVenc = loan.paymentType === 'diario'
            ? dataBase.add(i, 'day')
            : dataBase.add(i, 'month');
          const recibosPagos = loanReceipts.length;
          const pago = recibosPagos >= i;
          if (!pago && dataVenc.isBefore(dayjs(), 'day')) {
            isOverdue = true;
            break;
          }
        }
      } else if (loan.paymentType === 'interest_only') {
        // Para juros, vencido se não houver recibo para o mês vencido
        const dataBase = loan.startDate ? dayjs(loan.startDate) : dayjs(loan.createdAt);
        const meses = loanReceipts.length + 1;
        for (let i = 1; i <= meses; i++) {
          let dataVenc = dataBase.add(i, 'month');
          const reciboMes = loanReceipts.find(r => r.date && dayjs(r.date).isSame(dataVenc, 'month'));
          if (!reciboMes && dataVenc.isBefore(dayjs(), 'day')) {
            isOverdue = true;
            break;
          }
        }
      }
    }
    return {
      ...loan,
      payments: loanPayments,
      receipts: loanReceipts,
      _isOverdue: isOverdue
    };
  });

  // Contagem de ativos (não concluídos)
  const activeCount = loansWithPayments.filter(loan => {
    const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
    const recibosDoEmprestimo = receipts ? receipts.filter((r) => r.loanId === loan.id) : [];
    const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
    return status !== 'completed';
  }).length;

  // Filter loans by search term and status (usando getLoanStatus para garantir consistência com tela de detalhes)
  const filteredLoans = loansWithPayments.filter(loan => {
    const clientName = getClientName(loan.clientId).toLowerCase();
    const matchesSearch = clientName.includes(searchTerm.toLowerCase());
    // Filtra pagamentos e recibos do empréstimo atual, igual à tela de detalhes
    const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
    const recibosDoEmprestimo = receipts ? receipts.filter((r) => r.loanId === loan.id) : [];
    const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
    if (filterStatus === 'all') {
      return matchesSearch;
    }
    if (filterStatus === 'active') {
      // Mostra todos que NÃO são concluídos (ativos + vencidos)
      return matchesSearch && status !== 'completed';
    }
    if (filterStatus === 'completed') {
      return matchesSearch && status === 'completed';
    }
    if (filterStatus === 'defaulted' || filterStatus === 'inadimplente' || filterStatus === 'inadimplentes' || filterStatus === 'overdue') {
      return matchesSearch && status === 'overdue';
    }
    return matchesSearch;
  });

  // Handle loan deletion
  const handleDeleteLoan = (loanId: string) => {
    if (window.confirm('Tem certeza que deseja apagar este empréstimo? Esta ação não pode ser desfeita.')) {
      deleteLoanCascade(loanId)
        .then(() => {
          alert('Empréstimo apagado com sucesso!');
        })
        .catch((error) => {
          console.error('Erro ao apagar o empréstimo:', error);
          alert('Erro ao apagar o empréstimo. Tente novamente mais tarde.');
        });
    }
  };

  // Seleção de empréstimos
  const toggleSelectLoan = (loanId: string) => {
    setSelectedLoans((prev) =>
      prev.includes(loanId) ? prev.filter(id => id !== loanId) : [...prev, loanId]
    );
  };
  const selectAll = () => {
    setSelectedLoans(filteredLoans.map(l => l.id));
  };
  const deselectAll = () => {
    setSelectedLoans([]);
  };

  // Exclusão múltipla
  const handleDeleteSelected = async () => {
    if (selectedLoans.length === 0) return;
    if (window.confirm(`Tem certeza que deseja apagar ${selectedLoans.length} empréstimo(s)? Esta ação não pode ser desfeita.`)) {
      for (const loanId of selectedLoans) {
        await deleteLoanCascade(loanId);
      }
      alert('Empréstimos apagados com sucesso!');
      setSelectedLoans([]);
    }
  };

  return (
    <div className="p-2 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm">Empréstimos</h1>
        <Link 
          to="/loans/add" 
          className="btn btn-primary flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
        >
          <Plus size={20} /> Novo Empréstimo
        </Link>
      </div>

      {/* Botão de exclusão múltipla */}
      {selectedLoans.length > 0 && (
        <div className="mb-4 flex gap-2 items-center animate-fade-in">
          <button onClick={handleDeleteSelected} className="btn btn-danger shadow-md">
            Excluir Selecionados ({selectedLoans.length})
          </button>
          <button onClick={deselectAll} className="btn btn-secondary text-xs shadow-md">Limpar Seleção</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative rounded-xl shadow-lg bg-white border border-gray-200">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="form-input pl-10 py-3 bg-transparent focus:bg-gray-50 rounded-xl"
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div>
          <select
            className="form-input py-3 rounded-xl shadow-lg bg-white border border-gray-200"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos ({activeCount})</option>
            <option value="completed">Concluídos</option>
            <option value="defaulted">Inadimplentes</option>
          </select>
        </div>
      </div>

      {/* Loan list */}
      {filteredLoans.length > 0 ? (
        <div className="overflow-x-auto bg-white shadow-xl rounded-2xl border border-gray-100 animate-fade-in">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedLoans.length === filteredLoans.length && filteredLoans.length > 0}
                    onChange={e => e.target.checked ? selectAll() : deselectAll()}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcelas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Início
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modalidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-indigo-50 transition-all duration-200 group rounded-xl">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedLoans.includes(loan.id)}
                      onChange={() => toggleSelectLoan(loan.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{getClientName(loan.clientId)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-indigo-700 font-extrabold drop-shadow-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        loan.paymentType === 'diario' && loan.installments && loan.installmentAmount
                          ? loan.installments * loan.installmentAmount
                          : loan.totalAmount
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">
                      Capital: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(loan.installments || loan.numberOfInstallments) ? `${loan.installments || loan.numberOfInstallments}x` : '-'}
                      {loan.installmentAmount ? ` de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.installmentAmount)}` : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(() => {
                        // Lógica igual à tela de detalhes: mostra o próximo vencimento pendente ou o último vencimento se todos pagos
                        const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
                        const dataInicio = loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null);
                        if (!dataInicio || totalParcelas === 0) return '-';
                        // Gera todas as datas de vencimento
                        let datasVenc = [];
                        if (loan.paymentType === 'diario') {
                          for (let i = 0; i < totalParcelas; i++) {
                            let d = new Date(dataInicio);
                            d.setDate(d.getDate() + i);
                            datasVenc.push(d);
                          }
                        } else if (loan.paymentType === 'installments' || loan.paymentType === 'interest_only') {
                          for (let i = 0; i < totalParcelas; i++) {
                            let d = new Date(dataInicio);
                            const diaOriginal = d.getDate();
                            d.setMonth(d.getMonth() + i);
                            if (d.getDate() !== diaOriginal) {
                              d.setDate(0);
                            }
                            datasVenc.push(d);
                          }
                        }
                        // Verifica recibos pagos
                        const recibosPagos = loan.receipts || [];
                        let proximoVencimento = null;
                        for (let i = 0; i < datasVenc.length; i++) {
                          const dataObj = datasVenc[i];
                          const dataStr = dataObj.toISOString().slice(0,10);
                          const pago = recibosPagos.some(r => r.date && (new Date(r.date)).toISOString().slice(0,10) === dataStr);
                          if (!pago) {
                            proximoVencimento = dataObj;
                            break;
                          }
                        }
                        // Se todos pagos, mostra o último vencimento
                        if (!proximoVencimento && datasVenc.length > 0) {
                          proximoVencimento = datasVenc[datasVenc.length - 1];
                        }
                        return proximoVencimento ? proximoVencimento.toLocaleDateString('pt-BR') : '-';
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {loan.paymentType === 'diario' ? 'Diário' : loan.paymentType === 'installments' ? 'Parcelado' : loan.paymentType === 'interest_only' ? 'Somente Juros' : 'Outro'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      // Filtra pagamentos e recibos do empréstimo atual, igual à tela de detalhes
                      const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
                      const recibosDoEmprestimo = receipts ? receipts.filter((r) => r.loanId === loan.id) : [];
                      const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
                      if (status === 'completed') {
                        return <span className="ml-2 px-2 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Concluído</span>;
                      }
                      if (status === 'overdue') {
                        return <span className="ml-2 px-2 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Vencido</span>;
                      }
                      return <span className="ml-2 px-2 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2 items-center">
                    <Link to={`/loans/${loan.id}`} className="btn btn-sm btn-primary shadow hover:scale-105 transition-transform">Detalhes</Link>
                    <button
                      onClick={() => handleDeleteLoan(loan.id)}
                      className="btn btn-sm btn-danger shadow hover:scale-105 transition-transform"
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum empréstimo encontrado</h3>
          <p className="mt-2 text-gray-500">
            {searchTerm || filterStatus !== 'all' ? 'Nenhum resultado encontrado para os filtros aplicados.' : 'Comece adicionando um novo empréstimo.'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <div className="mt-6">
              <Link to="/loans/add" className="btn btn-primary inline-flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Novo Empréstimo
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}