// Script para depuração: mostra IDs e nomes dos empréstimos NÃO ativos
import { useLocalData } from '../contexts/SupabaseContext';
import { getLoanStatus } from '../utils/loanStatus';


  const { loans, receipts } = useLocalData();
  const notActive = loans.filter(loan => getLoanStatus(loan, receipts, loan.payments || []) !== 'active');

  return (
    <div style={{ padding: 20 }}>
      <h2>Empréstimos NÃO Ativos ({notActive.length})</h2>
      <ul>
        {notActive.map(loan => (
          <li key={loan.id}>
            <strong>ID:</strong> {loan.id} | <strong>Cliente:</strong> {loan.clientId} | <strong>Valor:</strong> {loan.amount} | <strong>Status:</strong> {getLoanStatus(loan, receipts, loan.payments || [])}
          </li>
        ))}
      </ul>
    </div>
  );
}
