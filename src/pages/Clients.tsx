import { useState } from 'react';
import { Plus, Search, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';

export default function Clients() {
  const { clients, deleteClientCascade } = useLocalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  let filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    client.phone.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenação por nome
  filteredClients = filteredClients.sort((a, b) => {
    if (sortAsc) {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

  // Seleção múltipla
  const toggleSelectClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };
  const selectAll = () => {
    setSelectedClients(filteredClients.map(c => c.id));
  };
  const deselectAll = () => {
    setSelectedClients([]);
  };

  // Exclusão múltipla
  const handleDeleteSelected = async () => {
    if (selectedClients.length === 0) return;
    if (window.confirm(`Tem certeza que deseja apagar ${selectedClients.length} cliente(s)? Esta ação não pode ser desfeita. Todos os empréstimos e recibos relacionados também serão excluídos!`)) {
      for (const clientId of selectedClients) {
        await deleteClientCascade(clientId);
      }
      alert('Clientes apagados com sucesso!');
      setSelectedClients([]);
      setDeleteMode(false);
    }
  };

  return (
    <div className="p-2 md:p-8 animate-fade-in min-h-[90vh] bg-gradient-to-br from-white via-indigo-50 to-purple-50">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="section-title drop-shadow-lg">Clientes</h1>
        <div className="flex gap-2 items-center">
          <Link 
            to="/clients/add" 
            className="btn btn-primary flex items-center gap-2 shadow-xl hover:scale-105 transition-transform text-lg px-6 py-3"
          >
            <Plus size={24} /> Novo Cliente
          </Link>
          {!deleteMode && (
            <button onClick={() => setDeleteMode(true)} className="btn btn-danger flex items-center gap-2 shadow-xl hover:scale-105 transition-transform text-lg px-6 py-3">
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Botões de exclusão múltipla aparecem apenas no modo de exclusão, ao lado do botão Novo Cliente */}

      {/* Search */}
      <div className="mb-8">
        <div className="relative rounded-2xl shadow-xl bg-white border border-gray-200">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="input-modern pl-10 py-4 text-lg"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Client list */}
      <div className="mb-4 text-right text-sm text-gray-600">
        Total de clientes: <span className="font-bold text-indigo-700">{filteredClients.length}</span>
      </div>
      {filteredClients.length > 0 ? (
        <div className="overflow-x-auto card p-0">
          <table className="table-modern">
            <thead className="sticky top-0 z-10">
              <tr>
                <th
                  className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => setSortAsc(s => !s)}
                >
                  Nome
                  <span className="ml-1 text-indigo-500">{sortAsc ? '▲' : '▼'}</span>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cidade</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, idx) => (
                <tr key={client.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} style={{ transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#eef2ff'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center font-bold text-indigo-700 text-lg group-hover:text-indigo-900 transition-colors">
                      {client.code && (
                        <span className="mr-2 px-2 py-0.5 rounded bg-indigo-100 text-xs text-indigo-700 font-mono border border-indigo-300 shadow-sm">{client.code}</span>
                      )}
                      {client.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">{client.phone}</div>
                    <div className="text-xs text-gray-500">{client.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">{client.cpf}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">{client.city}, {client.state}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          <UserX className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum cliente cadastrado</h3>
          <p className="mt-2 text-gray-500">
            {searchTerm ? 'Nenhum resultado encontrado para sua busca.' : 'Comece adicionando um novo cliente.'}
          </p>
          {!searchTerm && (
            <div className="mt-6">
              <Link to="/clients/add" className="btn btn-primary inline-flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}