import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Download, User, CreditCard } from 'lucide-react';
import { useLocalData } from '../contexts/SupabaseContext';
import { Client, Loan, Receipt } from '../types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { receipts, clients, loans } = useLocalData();
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);

  useEffect(() => {
    if (id) {
      const foundReceipt = receipts.find(r => r.id === id);
      if (foundReceipt) {
        setReceipt(foundReceipt);
        
        // Find client and loan
        const foundClient = clients.find(c => c.id === foundReceipt.clientId);
        const foundLoan = loans.find(l => l.id === foundReceipt.loanId);
        
        if (foundClient) setClient(foundClient);
        if (foundLoan) setLoan(foundLoan);
      } else {
        navigate('/receipts');
      }
    }
  }, [id, receipts, clients, loans, navigate]);

  // Função auxiliar para montar o conteúdo do PDF
  function montarConteudoPDF(receipt: Receipt, client: Client, loan: Loan) {
    const parcela = loan.payments?.find(p => p.id === receipt.paymentId)?.installmentNumber || '-';
    const totalParcelas = loan.installments || '-';
    const valorParcela = receipt.amount;
    return [
      `Cliente: ${client.name}`,
      `Vencimento: ${new Date(receipt.date).toLocaleDateString('pt-BR')}`,
      `Data de pagamento: ${new Date(receipt.date).toLocaleDateString('pt-BR')}`,
      `Parcela paga: ${parcela}/${totalParcelas} - Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorParcela)}`
    ];
  }

  const generatePDF = () => {
    if (!receipt || !client || !loan) return;
    const doc = new jsPDF();
    
    // Add content to PDF
    doc.setFontSize(18);
    doc.text('Recibo virtual', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Doc Nº${receipt.receiptNumber}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    const content = montarConteudoPDF(receipt, client, loan);
    
    content.forEach((line, index) => {
      doc.text(line, 20, 50 + (index * 10));
    });
    
    // Save the PDF
    const filename = `recibo_${client.name.toLowerCase().replace(/\s+/g, '_')}_${receipt.receiptNumber}.pdf`;
    doc.save(filename);
  };

  const printReceipt = () => {
    window.print();
  };

  const downloadReceipt = () => {
    generatePDF();
  };

  // Adicionar checagem de null antes de acessar receipt/client
  if (!receipt || !client || !loan) {
    return <div className="p-4 text-center">Carregando...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/receipts')}
            className="text-gray-500 hover:text-gray-700 flex items-center"
          >
            <ArrowLeft size={20} className="mr-1" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Recibo #{receipt.receiptNumber}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadReceipt}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Recibo estilo WhatsApp */}
      <div className="bg-white shadow-lg rounded-xl p-6 max-w-lg mx-auto border border-gray-200 mt-8 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-xl font-bold tracking-wide mb-2 text-gray-800">RECIBO</h2>
          <span className="text-xs text-gray-400 mb-4">Nº {receipt.receiptNumber} - {new Date(receipt.date).toLocaleDateString('pt-BR')}</span>
          <div className="w-full border-t border-dashed border-gray-300 my-4"></div>
          <p className="text-base leading-relaxed text-gray-700 mb-6 whitespace-pre-line">
            Recebi(emos) de <span className="font-bold text-indigo-700">{client.name}</span>{client.cpf && (<span> (CPF: <span className="font-mono">{client.cpf}</span>)</span>)}
            {', '}a importância de <span className="font-bold text-green-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receipt.amount)}</span>
            {` (${valorPorExtenso(receipt.amount)})`}, referente ao pagamento da {loan.installments && loan.installments > 1 ? `parcela ${loan.payments?.find(p => p.id === receipt.paymentId)?.installmentNumber || '-'} de ${loan.installments}` : 'parcela única'} do empréstimo código <span className="font-mono">{loan.id.slice(-4)}</span>.
          </p>
          <div className="w-full border-t border-dashed border-gray-300 my-4"></div>
          <div className="w-full flex flex-col items-center mt-4">
            <span className="text-xs text-gray-500 mb-2">Emitido em {new Date(receipt.date).toLocaleDateString('pt-BR')}.</span>
            <span className="text-xs text-gray-500 mb-2">Para maior clareza, firmo o presente recibo.</span>
            <div className="h-12"></div>
            <div className="border-t border-gray-400 w-48 my-2"></div>
            <span className="text-sm text-gray-700 font-medium">Assinatura do Responsável</span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="mt-6 flex flex-col md:flex-row gap-4 justify-center">
        <Link 
          to={`/clients/${client.id}`}
          className="btn flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <User size={18} />
          Ver Cliente
        </Link>
        <Link 
          to={`/loans/${loan.id}`}
          className="btn flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <CreditCard size={18} />
          Ver Empréstimo
        </Link>
        <button
          onClick={printReceipt}
          className="btn flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Printer size={18} />
          Imprimir
        </button>
      </div>
    </div>
  );
}

// Função para converter valor para extenso
function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  
  // Simplificação para fins de demonstração
  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  
  let extenso = '';
  
  if (reais > 0) {
    if (reais === 1) {
      extenso += 'um real';
    } else {
      // Simplificação - implementação real seria mais complexa
      extenso += `${reais} reais`;
    }
  }
  
  if (centavos > 0) {
    if (extenso !== '') extenso += ' e ';
    
    if (centavos === 1) {
      extenso += 'um centavo';
    } else {
      extenso += `${centavos} centavos`;
    }
  }
  
  return extenso;
}

