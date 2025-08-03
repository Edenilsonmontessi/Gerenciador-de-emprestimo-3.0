// Script para depuração: mostra detalhes dos empréstimos de Katiane e Thacyla
import { useLocalData } from '../contexts/SupabaseContext';
import { getLoanStatus } from '../utils/loanStatus';


  const { loans, receipts, clients } = useLocalData();
  const nomes = ["Katiane de Souza soares", "Thacylla Ingrid Coelho rachid"];
  const encontrados = loans.filter(loan => {
    const client = clients.find(c => c.id === loan.clientId);
    return client && nomes.some(nome => client.name.toLowerCase().includes(nome.toLowerCase()));
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>Empréstimos de Katiane e Thacyla</h2>
      <ul>
        {encontrados.map(loan => {
          const client = clients.find(c => c.id === loan.clientId);
          return (
            <li key={loan.id}>
              <strong>ID:</strong> {loan.id} | <strong>Cliente:</strong> {client?.name || loan.clientId} | <strong>Valor:</strong> {loan.amount} | <strong>Status:</strong> {getLoanStatus(loan, receipts, loan.payments || [])}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
