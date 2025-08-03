// Script para depuração: mostra IDs e nomes dos empréstimos ativos
import { useLocalData } from '../contexts/SupabaseContext';
import { getLoanStatus } from '../utils/loanStatus';


  const { loans, receipts, clients } = useLocalData();
  // Filtra empréstimos ativos ou atrasados
  const ativosRaw = loans.filter(loan => {
    const status = getLoanStatus(loan, receipts, loan.payments || []);
    return status === 'active' || status === 'overdue';
  });
  // Agrupa por cliente e pega o mais recente (maior data de criação)
  const ativosPorCliente: { [clientId: string]: typeof ativosRaw[0] } = {};
  ativosRaw.forEach(loan => {
    if (!ativosPorCliente[loan.clientId] || new Date(loan.createdAt) > new Date(ativosPorCliente[loan.clientId].createdAt)) {
      ativosPorCliente[loan.clientId] = loan;
    }
  });
  const ativos = Object.values(ativosPorCliente);
  const nomes = ["Katiane de Souza soares", "Thacylla Ingrid Coelho rachid"];
  const especiais = loans.filter(loan => {
    const client = clients.find(c => c.id === loan.clientId);
    return client && nomes.some(nome => client.name.toLowerCase().includes(nome.toLowerCase()));
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>Empréstimos Ativos ({ativos.length})</h2>
      <ul>
        {ativos.map(loan => {
          const client = clients.find(c => c.id === loan.clientId);
          return (
            <li key={loan.id}>
              <strong>ID:</strong> {loan.id} | <strong>Cliente:</strong> {client?.name || loan.clientId} | <strong>Valor:</strong> {loan.amount}
            </li>
          );
        })}
      </ul>
      <h2 style={{marginTop:32}}>Empréstimos de Katiane e Thacylla</h2>
      <ul>
        {especiais.map(loan => {
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
