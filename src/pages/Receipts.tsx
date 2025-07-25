import { useState } from 'react';
import { Search, Receipt as ReceiptIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';

export default function Receipts() {
  const { receipts, clients, deleteReceipt } = useLocalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);

  // Get client name by ID
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente desconhecido';
  };

  // Filter receipts by search term
  const filteredReceipts = receipts.filter(receipt => {
    const clientName = getClientName(receipt.clientId).toLowerCase();
    const receiptNumber = receipt.receiptNumber.toLowerCase();
    
    return clientName.includes(searchTerm.toLowerCase()) || 
           receiptNumber.includes(searchTerm.toLowerCase());
  });

  const handleDeleteReceipt = async (receiptId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este recibo? Esta ação não pode ser desfeita.')) {
      try {
        await deleteReceipt(receiptId);
        alert('Recibo excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir recibo:', error);
        alert('Erro ao excluir recibo. Tente novamente mais tarde.');
      }
    }
  };

  // Seleção múltipla
  const toggleSelectReceipt = (receiptId: string) => {
    setSelectedReceipts((prev) =>
      prev.includes(receiptId) ? prev.filter(id => id !== receiptId) : [...prev, receiptId]
    );
  };
  const selectAll = () => {
    setSelectedReceipts(filteredReceipts.map(r => r.id));
  };
  const deselectAll = () => {
    setSelectedReceipts([]);
  };

  // Exclusão múltipla
  const handleDeleteSelected = async () => {
    if (selectedReceipts.length === 0) return;
    if (window.confirm(`Tem certeza que deseja apagar ${selectedReceipts.length} recibo(s)? Esta ação não pode ser desfeita.`)) {
      for (const receiptId of selectedReceipts) {
        await deleteReceipt(receiptId);
      }
      alert('Recibos apagados com sucesso!');
      setSelectedReceipts([]);
    }
  };

  return (
    <div className="p-2 md:p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="section-title">Recibos</h1>
      </div>

      {/* Botão de exclusão múltipla */}
      {selectedReceipts.length > 0 && (
        <div className="mb-4 flex gap-2 items-center animate-fade-in">
          <button onClick={handleDeleteSelected} className="btn btn-danger shadow-md">
            Excluir Selecionados ({selectedReceipts.length})
          </button>
          <button onClick={deselectAll} className="btn btn-secondary text-xs shadow-md">Limpar Seleção</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative rounded-xl shadow-lg bg-white border border-gray-200">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="input-modern pl-10 py-3"
            placeholder="Buscar por cliente ou número do recibo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Receipt list */}
      {filteredReceipts.length > 0 ? (
        <div className="overflow-x-auto card">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedReceipts.length === filteredReceipts.length && filteredReceipts.length > 0}
                    onChange={e => e.target.checked ? selectAll() : deselectAll()}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número do Recibo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedReceipts.includes(receipt.id)}
                      onChange={() => toggleSelectReceipt(receipt.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{receipt.receiptNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(receipt.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getClientName(receipt.clientId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receipt.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2 items-center">
                    <Link to={`/receipts/${receipt.id}`} className="btn btn-xs btn-primary shadow hover:scale-105 transition-transform">Ver</Link>
                    <button
                      onClick={() => handleDeleteReceipt(receipt.id)}
                      className="btn btn-xs btn-danger shadow hover:scale-105 transition-transform"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg p-12 text-center">
          <ReceiptIcon className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum recibo gerado</h3>
          <p className="mt-2 text-gray-500">
            {searchTerm ? 'Nenhum resultado encontrado para sua busca.' : 'Os recibos serão gerados automaticamente quando registrar pagamentos.'}
          </p>
        </div>
      )}
    </div>
  );
}