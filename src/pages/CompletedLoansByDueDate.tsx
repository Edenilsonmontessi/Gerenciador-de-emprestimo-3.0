import { useLocalData } from '../contexts/SupabaseContext';
import { getLoanStatus } from '../utils/loanStatus';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useState } from 'react';

export default function CompletedLoans() {
  const { loans, clients, payments, receipts, deleteLoanCascade } = useLocalData();
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  // Função para apagar empréstimo
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

  // Filtra apenas o último empréstimo concluído de cada cliente
  const completedLoans = (() => {
    // Primeiro, filtra todos os empréstimos concluídos
    const allCompleted = loans.filter(loan => {
      const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
      const recibosDoEmprestimo = receipts ? receipts.filter((r) => r.loanId === loan.id) : [];
      const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
      return status === 'completed';
    });
    // Agora, para cada cliente, pega apenas o último empréstimo concluído
    const latestByClient = new Map();
    allCompleted.forEach(loan => {
      const prev = latestByClient.get(loan.clientId);
      if (!prev || new Date(loan.dueDate || loan.createdAt || 0) > new Date(prev.dueDate || prev.createdAt || 0)) {
        latestByClient.set(loan.clientId, loan);
      }
    });
    // Remove clientes que já possuem empréstimo em aberto ou em andamento
    const clientsWithActiveLoan = new Set(
      loans.filter(loan => {
        const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
        const recibosDoEmprestimo = receipts ? receipts.filter((r) => r.loanId === loan.id) : [];
        const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
        return status !== 'completed';
      }).map(loan => loan.clientId)
    );
    return Array.from(latestByClient.values()).filter(loan => !clientsWithActiveLoan.has(loan.clientId));
  })();

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente desconhecido';
  };

  return (
    <div className="p-2 md:p-6">
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm mb-8">Empréstimos Concluídos</h1>
      {completedLoans.length > 0 ? (
        <div className="overflow-x-auto bg-white shadow-xl rounded-2xl border border-gray-100 animate-fade-in">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modalidade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {completedLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-indigo-50 transition-all duration-200 group rounded-xl">
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{loan.dueDate ? dayjs(loan.dueDate).format('DD/MM/YYYY') : '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {loan.paymentType === 'diario' ? 'Diário' : loan.paymentType === 'installments' ? 'Parcelado' : loan.paymentType === 'interest_only' ? 'Somente Juros' : 'Outro'}
                    </div>
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
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum empréstimo concluído encontrado</h3>
        </div>
      )}
    </div>
  );
}
