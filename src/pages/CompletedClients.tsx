import { Link } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';

export default function CompletedClients() {
  const { clients, loans } = useLocalData();
  // Filtra clientes que possuem ao menos um empréstimo concluído
  const completedClients = clients.filter(client =>
    loans.some(loan => loan.clientId === client.id && loan.status === 'completed')
  );

  return (
    <div className="p-8 animate-fade-in min-h-[90vh] bg-gradient-to-br from-white via-indigo-50 to-purple-50">
      <h1 className="section-title mb-8">Clientes Concluídos</h1>
      {completedClients.length > 0 ? (
        <div className="overflow-x-auto card p-0">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {completedClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <span className="mr-2 px-2 py-0.5 rounded bg-indigo-100 text-xs text-indigo-700 font-mono border border-indigo-300 shadow-sm">{client.code}</span>
                    {client.name}
                  </td>
                  <td>{client.phone}</td>
                  <td>
                    {/* Garante que o link vai para detalhes do cliente */}
                    <Link to={`/clients/${client.id}`} className="btn btn-xs btn-primary shadow hover:scale-105 transition-transform">
                      Detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg p-12 text-center">
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum cliente concluído</h3>
        </div>
      )}
    </div>
  );
}
