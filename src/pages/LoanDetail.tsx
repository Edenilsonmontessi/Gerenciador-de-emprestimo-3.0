import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useLocalData } from '../contexts/SupabaseContext';
import { Client, Loan, Payment } from '../types';
import { format } from 'date-fns';
import { gerarRecibo } from '../utils/reciboGenerator';
import { getLoanStatus } from '../utils/loanStatus';

export default function LoanDetail() {
  // Estados para forçar exibição de quitação
  const [quitacaoForcada, setQuitacaoForcada] = useState(false);
  const [totalPagoForcado, setTotalPagoForcado] = useState<number | null>(null);
  const [saldoForcado, setSaldoForcado] = useState<number | null>(null);
  // Função para gerar lista de vencimentos recalculada, sempre usando loan.dueDate se existir
function getVencimentos(
  loan: Loan,
  receipts: { loanId: string; date?: string; amount?: number }[]
): Date[] {
  let datas: Date[] = [];
  let totalParcelas = loan.installments || loan.numberOfInstallments || 0;
  let dataBase: Date | null = null;
  if (loan.paymentType === 'diario') {
    // Para diário, sempre usa startDate (ou createdAt) como base
    dataBase = loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null);
    if (!dataBase) return [];
    for (let i = 0; i < totalParcelas; i++) {
      let d = new Date(dataBase);
      d.setDate(d.getDate() + i);
      datas.push(d);
    }
  } else if (loan.paymentType === 'interest_only') {
    // Para somente juros, gera uma data de vencimento para cada recibo, sempre mês a mês a partir do dueDate
    // Corrige: cria Date com 'T12:00:00' para evitar erro de fuso horário
    dataBase = loan.dueDate ? new Date(loan.dueDate + 'T12:00:00') : null;
    if (!dataBase) return [];
    const qtd = receipts.filter(r => r.loanId === loan.id).length;
    for (let i = 0; i < qtd + 1; i++) { // +1 para mostrar o próximo vencimento
      let d = new Date(dataBase);
      const diaOriginal = d.getDate();
      d.setMonth(d.getMonth() + i);
      if (d.getDate() !== diaOriginal) {
        d.setDate(0);
      }
      datas.push(d);
    }
  } else {
    // Para outras modalidades, pode usar dueDate, startDate ou createdAt
    dataBase = loan.dueDate ? new Date(loan.dueDate + 'T12:00:00') : (loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null));
    if (!dataBase) return [];
    for (let i = 0; i < totalParcelas; i++) {
      let d = new Date(dataBase);
      const diaOriginal = d.getDate();
      d.setMonth(d.getMonth() + i);
      if (d.getDate() !== diaOriginal) {
        d.setDate(0);
      }
      datas.push(d);
    }
  }
  return datas;
}
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, loans, receipts, payments, deleteReceipt, updateLoan, addReceipt, addPayment, refetchLoans } = useLocalData();
  
  const [client, setClient] = useState<Client | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isQuitacao, setIsQuitacao] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1);
  // Novo: estado para selecionar vencimento ao registrar pagamento
  const [selectedDueDate, setSelectedDueDate] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // Inicializa como string vazia
  const [showDeleteReceiptModal, setShowDeleteReceiptModal] = useState<string | null>(null);
  const [showEditDueDate, setShowEditDueDate] = useState(false);
  // Novo estado para data de pagamento customizada
  const [customPaymentDate, setCustomPaymentDate] = useState<string>('');
  // newDueDate sempre inicializa do valor persistido em loan.dueDate
  const [newDueDate, setNewDueDate] = useState('');
  useEffect(() => {
    if (loan?.dueDate) {
      setNewDueDate(loan.dueDate.substring(0, 10));
    }
  }, [loan?.dueDate]);
  const [savingDueDate, setSavingDueDate] = useState(false);

  useEffect(() => {
    if (id) {
      const foundLoan = loans.find(l => l.id === id);
      if (foundLoan) {
        setLoan(foundLoan);
        const foundClient = clients.find(c => c.id === foundLoan.clientId);
        if (foundClient) setClient(foundClient);

        // Centraliza a lógica de status usando getLoanStatus com todos os pagamentos do sistema
        const pagamentosDoEmprestimo = payments.filter(p => p.loanId === foundLoan.id);
        const newStatus = getLoanStatus(foundLoan, receipts, pagamentosDoEmprestimo);
        if (newStatus !== foundLoan.status) {
          updateLoan(foundLoan.id, { status: newStatus });
          setLoan({ ...foundLoan, status: newStatus });
        }

        // Sincroniza quitação forçada após atualização/refetch
        // Se o status for 'completed' e o total pago for igual ao total com juros, mantém quitação forçada
        // Usar pagamentosDoEmprestimo já definido acima (do contexto global)
        const recibosDoEmprestimo = receipts.filter(r => r.loanId === foundLoan.id);
        const totalComJuros = ((foundLoan.paymentType === 'diario' || foundLoan.paymentType === 'installments') && foundLoan.installments && foundLoan.installmentAmount)
          ? foundLoan.installments * foundLoan.installmentAmount
          : foundLoan.totalAmount;
        const totalPago = recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0) + pagamentosDoEmprestimo.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (foundLoan.status === 'completed' && Math.abs(totalPago - totalComJuros) < 0.01) {
          setQuitacaoForcada(true);
          setTotalPagoForcado(totalComJuros);
          setSaldoForcado(0);
        } else {
          setQuitacaoForcada(false);
          setTotalPagoForcado(null);
          setSaldoForcado(null);
        }
      }
    }
  }, [id, loans, clients, receipts, payments, updateLoan]);

  const handleViewReceipt = (payment: Payment) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const receiptMessage = `RECIBO DE PAGAMENTO\n\n` +
      `Cliente: ${client?.name}\n` +
      `Data do Pagamento: ${format(new Date(payment.date), 'dd/MM/yyyy')}\n` +
      `Valor Pago: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}\n` +
      `--------------------------\n` +
      `Obrigado por utilizar nossos serviços!`;

    alert(receiptMessage);
  };

  // Função para compartilhar recibo via WhatsApp
  function handleSendReceiptWhatsAppFromReceipt(receipt: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    if (!client || !loan) return;
    let telefone = client.phone || '';
    telefone = telefone.replace(/\D/g, '');
    if (telefone.length >= 11 && telefone.startsWith('0')) {
      telefone = telefone.replace(/^0+/, '');
    }
    if (telefone.length === 11) {
      telefone = '55' + telefone;
    }
    if (telefone.length === 13 && telefone.startsWith('55') && telefone[4] === '0') {
      telefone = '55' + telefone.slice(5);
    }
    if (!/^\d{12,13}$/.test(telefone)) {
      alert('Telefone do cliente inválido! Informe no formato 67992825341, 067992825341 ou 5567992825341.');
      return;
    }

    // Descobre a parcela atual e total de parcelas, se aplicável
    let parcelaAtual: number | undefined = undefined;
      {/* Alerta de inconsistência: status concluído mas saldo a receber > 0 */}
      {loan.status === 'completed' && saldoAReceber > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
          <strong>Atenção:</strong> Este empréstimo está marcado como <b>concluído</b>, mas ainda possui saldo a receber de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoAReceber)}. Verifique os recibos, pagamentos ou o valor total do empréstimo.
        </div>
      )}
    let totalParcelas: number | undefined = undefined;
    if (loan.paymentType === 'diario') {
      // Para diário, conta recibos confirmados
      const recibosPagos = receipts.filter(r => r.loanId === loan.id);
      parcelaAtual = recibosPagos.length;
      totalParcelas = loan.installments || loan.numberOfInstallments || 0;
    } else if (loan.installments && loan.installments > 1) {
      // Parcelado tradicional
      const pagamentoRecibo = loan.payments?.find(p => p.id === receipt.paymentId);
      parcelaAtual = pagamentoRecibo?.installmentNumber ?? (receipts.filter(r => r.loanId === loan.id).length);
      totalParcelas = loan.installments;
    }

    // Calcula o total pago confirmado para o recibo
    const recibosDoEmprestimo = receipts.filter(r => r.loanId === loan.id);
    const pagoConfirmado = recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0);

    // Monta a mensagem do recibo conforme modelo solicitado
    let recibo: string;
    if (loan.paymentType === 'interest_only') {
      // Formato personalizado para somente juros
      const dataGeracao = format(new Date(), 'dd/MM/yyyy HH:mm');
      recibo = `RECIBO DE PAGAMENTO - Doc Nº ${receipt.receiptNumber}\n\n` +
        `Cliente: ${client.name}\n` +
        `Vencimento: ${loan.dueDate ? format(new Date(loan.dueDate + 'T00:00:00'), 'dd/MM/yyyy') : '-'}\n` +
        `Data de pagamento: ${receipt.date ? format(new Date(receipt.date), 'dd/MM/yyyy') : '-'}\n` +
        `Valor pago hoje: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receipt.amount)}\n` +
        `--------------------------\n\n` +
        `Gerado em: ${dataGeracao}\n\n` +
        `ATENÇÃO:\nOs dados acima informados são apenas para simples conferência e não servem como comprovante de pagamento.`;
    } else {
      const reciboData = {
        docNumero: receipt.receiptNumber,
        cliente: client.name,
        vencimento: loan.dueDate ? format(new Date(loan.dueDate + 'T00:00:00'), 'dd/MM/yyyy') : '-',
        valorPagoHoje: receipt.amount,
        parcelaAtual,
        totalParcelas,
        dataGeracao: new Date(),
        dataPagamento: receipt.date ? new Date(receipt.date) : new Date(),
        pagoConfirmado: pagoConfirmado,
      };
      recibo = gerarRecibo(reciboData);
    }
    const link = `https://wa.me/${telefone}?text=${encodeURIComponent(recibo)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  const handleSendReceiptWhatsApp = (payment: Payment) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // Busca o telefone do cliente diretamente da lista de clientes pelo id SEMPRE
    let telefone = '';
    if (client?.id) {
      const found = clients.find(c => c.id === client.id);
      telefone = found?.phone || '';
    }
    telefone = telefone.replace(/\D/g, '');
    if (telefone.length >= 11 && telefone.startsWith('0')) {
      telefone = telefone.replace(/^0+/, '');
    }
    if (telefone.length === 11) {
      telefone = '55' + telefone;
    }
    if (telefone.length === 13 && telefone.startsWith('55') && telefone[4] === '0') {
      telefone = '55' + telefone.slice(5);
    }
    if (!/^\d{12,13}$/.test(telefone)) {
      alert('Telefone do cliente inválido! Informe no formato 67992825341, 067992825341 ou 5567992825341.');
      return;
    }

    if (!loan || !client) return;
    // Corrigido: considera todos os pagamentos confirmados
    const pagamentos = loan.payments || [];
    const parcelaAtual = pagamentos.length;
    const totalParcelas = loan.installments;
    const pagoConfirmado = pagamentos.reduce((sum, p) => sum + p.amount, 0);
    const recibo = gerarRecibo({
      docNumero: loan.id.slice(-4),
      cliente: client.name,
      vencimento: loan.dueDate ? format(new Date(loan.dueDate + 'T00:00:00'), 'dd/MM/yyyy') : '-',
      valorPagoHoje: payment.amount,
      parcelaAtual,
      totalParcelas,
      pagoConfirmado,
      dataGeracao: new Date(),
      dataPagamento: payment.date ? new Date(payment.date) : new Date(), // Corrigido para usar a data do pagamento
    });

    const link = `https://wa.me/${telefone}?text=${encodeURIComponent(recibo)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Remover variáveis não utilizadas para evitar avisos
  // const handleDeletePayment = async (paymentId: string) => {
  //   if (!loan) return;

  //   if (window.confirm('Tem certeza que deseja excluir este pagamento? Esta ação não pode ser desfeita.')) {
  //     try {
  //       const updatedPayments = loan.payments?.filter((p) => p.id !== paymentId) || [];
  //       await updateLoan(loan.id, { payments: updatedPayments });
  //       setLoan({ ...loan, payments: updatedPayments });
  //       alert('Pagamento excluído com sucesso!');
  //     } catch (error) {
  //       console.error('Erro ao excluir pagamento:', error);
  //       alert('Erro ao excluir pagamento. Tente novamente mais tarde.');
  //     }
  //   }
  // };

  // Função para alterar a data de vencimento e reativar o empréstimo
  const handleSaveDueDate = async () => {
    if (!loan || !newDueDate) return;
    setSavingDueDate(true);
    try {
      // 1. Identifica quantas parcelas já foram pagas (recibos)
      const recibosPagos = receipts.filter(r => r.loanId === loan.id && r.dueDate);
      const qtdPagas = recibosPagos.length;
      const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
      // 2. Gera as novas datas: mantém as datas já pagas, só recalcula as próximas
      let novasDatas: string[] = [];
      // Datas já pagas
      novasDatas = recibosPagos.map(r => r.dueDate.slice(0,10));
      // Próxima data começa a partir da nova data informada
      let dataBase = new Date(newDueDate + 'T12:00:00');
      for (let i = 0; i < totalParcelas - qtdPagas; i++) {
        let d = new Date(dataBase);
        if (loan.paymentType === 'diario') {
          d.setDate(d.getDate() + i);
        } else {
          const diaOriginal = d.getDate();
          d.setMonth(d.getMonth() + i);
          if (d.getDate() !== diaOriginal) {
            d.setDate(0);
          }
        }
        novasDatas.push(d.toISOString().slice(0,10));
      }
      // 3. Atualiza o dueDate do empréstimo para a nova data escolhida
      const result = await updateLoan(loan.id, { dueDate: newDueDate, status: 'active' });
      if (result) {
        setLoan(prev => prev ? { ...prev, dueDate: newDueDate, status: 'active' } : prev);
        setShowEditDueDate(false);
        if (refetchLoans) {
          await refetchLoans();
        }
      }
      // 4. (Opcional) Poderia atualizar os recibos futuros para refletir as novas datas, se necessário
      // Isso depende de como os recibos são usados no sistema
    } catch (e) {
      alert('Erro ao atualizar vencimento!');
    }
    setSavingDueDate(false);
  };

  // Função para registrar pagamento
  const handlePayment = async () => {
    if (!loan) return;
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      alert('Informe um valor válido para o pagamento.');
      return;
    }
    let amount = Number(paymentAmount);
    let paymentType: 'full' | 'interest_only' = 'full';
    // Corrige o tipo do pagamento para modalidade somente juros
    if (loan.paymentType === 'interest_only' && !isQuitacao) {
      paymentType = selectedInstallment === 2 ? 'full' : 'interest_only';
    }
    // Usa a data customizada se informada, senão data atual
    const paymentDateISO = customPaymentDate ? new Date(customPaymentDate + 'T00:00:00').toISOString() : new Date().toISOString();
    // Não altera mais o dueDate automaticamente ao registrar pagamento
    let statusForcado: 'active' | 'completed' | undefined = undefined;
    // Se for quitação manual, força status para concluído em qualquer modalidade
    if (isQuitacao && loan.status === 'active') {
      statusForcado = 'completed';
    }
    // Se for modalidade somente juros e pagamento for 'full', conclui o empréstimo
    if (loan.paymentType === 'interest_only' && paymentType === 'full') {
      statusForcado = 'completed';
    }
    // Sempre usar a data de vencimento selecionada pelo usuário
    let dueDateStr = selectedDueDate;
    if (!dueDateStr) {
      alert('Selecione o vencimento que está sendo pago!');
      return;
    }
    const paymentToSave = {
      loanId: loan.id,
      amount,
      date: paymentDateISO,
      type: paymentType,
      installmentNumber: selectedInstallment || 1,
    };
    const savedPayment = await addPayment(paymentToSave);
    if (!savedPayment) {
      alert('Erro ao registrar pagamento!');
      return;
    }
    const receiptToSave = {
      loanId: loan.id,
      clientId: loan.clientId,
      paymentId: savedPayment.id,
      amount: savedPayment.amount,
      date: savedPayment.date,
      dueDate: dueDateStr || loan.dueDate || new Date().toISOString().slice(0, 10),
      receiptNumber: `REC-${Date.now().toString().slice(-4)}${loan.id.slice(-4)}`,
    };
    const savedReceipt = await addReceipt(receiptToSave);
    if (!savedReceipt) {
      alert('Erro ao registrar recibo!');
      return;
    }
    const updatedPayments = [...(loan.payments || []), savedPayment];
    const updatedReceipts = [...receipts, savedReceipt];
    const totalRecebido = [
      ...updatedReceipts.filter((r) => r.loanId === loan.id).map((r) => r.amount || 0),
      ...updatedPayments.filter((p) => p.loanId === loan.id).map((p) => p.amount || 0)
    ].reduce((sum, value) => sum + value, 0);
    // Sempre recalcula o status com base na lógica centralizada
    let newStatus = getLoanStatus(loan, updatedReceipts, updatedPayments);
    let totalPagoFinal = totalRecebido;
    if (isQuitacao) {
      newStatus = 'completed';
      totalPagoFinal = loan.paymentType === 'diario' || loan.paymentType === 'installments'
        ? (loan.installments && loan.installmentAmount ? loan.installments * loan.installmentAmount : loan.totalAmount)
        : loan.totalAmount;
      setQuitacaoForcada(true);
      setTotalPagoForcado(totalPagoFinal);
      setSaldoForcado(0);
    } else if (statusForcado !== undefined) {
      newStatus = statusForcado;
      setQuitacaoForcada(false);
      setTotalPagoForcado(null);
      setSaldoForcado(null);
    } else {
      setQuitacaoForcada(false);
      setTotalPagoForcado(null);
      setSaldoForcado(null);
    }
    // Atualiza o status no banco para garantir consistência na listagem
    await updateLoan(loan.id, { status: newStatus });
    setLoan({
      ...loan,
      payments: updatedPayments,
      status: newStatus
    });
    setPaymentAmount('');
    setIsQuitacao(false);
    if (refetchLoans) refetchLoans();
  };

  if (!loan || !client) {
    return <div className="p-4 text-center">Carregando...</div>;
  }
  // Cálculo correto do total pago, saldo a receber e parcelas pagas
  const recibosDoEmprestimo = receipts.filter(r => loan && r.loanId === loan.id);
  const pagamentosDoEmprestimo = loan.payments || [];
  // Se foi quitação, força total pago igual ao total com juros
  const totalPagoConfirmado = quitacaoForcada && totalPagoForcado !== null
    ? totalPagoForcado
    : recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0) + pagamentosDoEmprestimo.reduce((sum, p) => sum + (p.amount || 0), 0);
  const parcelasPagas = recibosDoEmprestimo.length;

  // Ajuste: saldo a receber por modalidade (considerando recibos + pagamentos)
  let saldoAReceber = 0;
  const totalComJuros = ((loan.paymentType === 'diario' || loan.paymentType === 'installments') && loan.installments && loan.installmentAmount)
    ? loan.installments * loan.installmentAmount
    : loan.totalAmount;
  // Se foi quitação, força saldo a receber para zero
  if (quitacaoForcada && saldoForcado !== null) {
    saldoAReceber = saldoForcado;
  } else if (loan.paymentType === 'interest_only') {
    // Só zera se houver pagamento do tipo 'full'
    const quitado = pagamentosDoEmprestimo.some(p => p.type === 'full');
    saldoAReceber = quitado ? 0 : totalComJuros;
  } else {
    saldoAReceber = Math.max(totalComJuros - totalPagoConfirmado, 0);
  }

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/loans')}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition shadow"
            title="Voltar para lista"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              Empréstimo <span className="text-indigo-600">#{loan.id.slice(-4)}</span>
            </h1>
            <div className="text-sm text-gray-500 mt-1">Cliente: <span className="font-semibold text-gray-700">{client.name}</span></div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setShowPaymentModal(true);
              setIsQuitacao(false);
            }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold shadow hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={saldoAReceber === 0}
          >
            <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' /></svg>
            Registrar Pagamento
          </button>
          {loan.status === 'defaulted' && (
            <button
              onClick={() => setShowEditDueDate(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-yellow-400 text-yellow-900 font-bold shadow hover:bg-yellow-500 transition"
            >
              <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7v10M16 7v10' /></svg>
              Alterar Vencimento
            </button>
          )}
        </div>
      </div>

      {/* Lista de vencimentos */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-medium">Vencimentos</h2>
          <button
            className="btn btn-xs btn-secondary"
            onClick={() => {
              // Calcula a data do próximo vencimento não pago usando a mesma lógica do getVencimentos
              const datas = getVencimentos(loan, receipts);
              const recibosPagos = receipts.filter((r: { loanId: string }) => r.loanId === loan.id);
              let nextDueDate = '';
              let found = false;
              for (let idx = 0; idx < datas.length; idx++) {
                const recibo = recibosPagos[idx];
                if (!recibo) {
                  nextDueDate = datas[idx] instanceof Date ? (datas[idx] as Date).toISOString().slice(0, 10) : String(datas[idx]);
                  found = true;
                  break;
                }
              }
              if (!found && datas.length > 0) {
                // Se todos pagos, pega a última
                nextDueDate = datas[datas.length - 1] instanceof Date ? (datas[datas.length - 1] as Date).toISOString().slice(0, 10) : String(datas[datas.length - 1]);
              }
              setShowEditDueDate(true);
              setNewDueDate(nextDueDate);
            }}
          >
            Editar data de vencimento
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const datas = getVencimentos(loan, receipts);
            // Considera pago apenas se houver recibo para a data OU se a data for a selecionada no modal de pagamento e o modal está aberto
            return datas.map((data, idx) => {
              let dataObj = data instanceof Date ? data : (typeof data === 'string' && (data as string).length === 10 ? new Date(data + 'T12:00:00') : new Date(data));
              let cor = 'bg-blue-100 text-blue-800';
              const dataStr = dataObj.toISOString().slice(0,10);
              // Se já existe recibo para a data OU se o usuário acabou de selecionar para pagar
              const pago = receipts.some(r => r.loanId === loan.id && r.dueDate && r.dueDate.slice(0,10) === dataStr) || (showPaymentModal && selectedDueDate === dataStr);
              if (pago) {
                cor = 'bg-green-100 text-green-800';
              } else if (new Date().toISOString().slice(0,10) > dataStr) {
                cor = 'bg-red-100 text-red-800';
              }
              return (
                <span key={idx} className={`px-3 py-1 rounded-full font-semibold ${cor}`}>
                  {dataObj.toLocaleDateString('pt-BR')}
                  {pago && ' (Pago)'}
                  {!pago && new Date().toISOString().slice(0,10) > dataStr && ' (Vencido)'}
                </span>
              );
            });
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Details */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Detalhes do Empréstimo</h2>
          <div className="space-y-4">
            <div>
              <span className="text-gray-500">Cliente:</span>
              <p className="font-medium">{client.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">Valor Principal:</span>
                <p className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loan.amount)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Total com Juros:</span>
                <p className="font-medium text-blue-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    loan.paymentType === 'diario' && loan.installments && loan.installmentAmount
                      ? loan.installments * loan.installmentAmount
                      : loan.totalAmount
                  )}
                </p>
                {loan.paymentType === 'interest_only' && (
                  <div className="mt-1">
                    <span className="text-gray-500">Valor somente juros:</span>
                    <p className="font-medium text-purple-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        loan.amount * (loan.interestRate / 100)
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">Taxa de Juros:</span>
                <p className="font-medium">{loan.interestRate}% ao mês</p>
              </div>
              {/* Vencimento removido conforme solicitado */}
            </div>
            {/* Valor somente juros agora aparece abaixo de Total com Juros */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-500">Status:</span>
              {(() => {
                // Filtra pagamentos e recibos do empréstimo atual, igual à listagem
                const pagamentosDoEmprestimo = payments.filter(p => p.loanId === loan.id);
                const recibosDoEmprestimo = receipts.filter(r => r.loanId === loan.id);
                const status = getLoanStatus(loan, recibosDoEmprestimo, pagamentosDoEmprestimo);
                if (status === 'completed') {
                  return <span className="px-2 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Concluído</span>;
                }
                if (status === 'overdue') {
                  return <span className="px-2 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Vencido</span>;
                }
                return <span className="px-2 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>;
              })()}
            </div>
            <div>
              <span className="text-gray-500">Modalidade:</span>
              <p className="font-medium">
                {loan.paymentType === 'interest_only'
                  ? 'Somente Juros'
                  : loan.paymentType === 'diario'
                  ? 'Diário'
                  : `Parcelado em ${loan.numberOfInstallments || loan.installments || 0}x`}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Parcelas:</span>
              <p className="font-medium">
                {(() => {
                  if (loan.paymentType === 'diario' && loan.payments && loan.payments.length > 0) {
                    // Agrupa pagamentos por valor
                    const pagamentosPorValor: Record<string, number> = {};
                    loan.payments.forEach(p => {
                      const valor = p.amount.toFixed(2);
                      pagamentosPorValor[valor] = (pagamentosPorValor[valor] || 0) + 1;
                    });
                    // Exibe agrupado, ex: '5 x R$ 10,00'
                    return Object.entries(pagamentosPorValor)
                      .map(([valor, qtd]) => `${qtd} x ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))}`)
                      .join(' + ');
                  }
                  // Padrão para outras modalidades
                  const qtdParcelas = loan.installments || loan.numberOfInstallments;
                  let valorParcela = loan.installmentAmount;
                  if ((!valorParcela || valorParcela === 0) && qtdParcelas) {
                    valorParcela = loan.totalAmount / qtdParcelas;
                  }
                  return qtdParcelas && valorParcela
                    ? `${qtdParcelas} x ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorParcela)}`
                    : '-';
                })()}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Observações:</span>
              <p className="font-medium whitespace-pre-line">{loan.notes || '-'}</p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Resumo Financeiro</h2>
          <div className="space-y-4">
            <div>
              <span className="text-gray-500">Total Pago:</span>
              <p className="text-xl font-semibold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPagoConfirmado)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Saldo a Receber:</span>
              <p className="text-xl font-semibold text-purple-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoAReceber)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Parcelas Pagas:</span>
              <p className="font-medium">
                {parcelasPagas}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Recibos */}
      <div className="mt-6 bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4">Histórico de Recibos</h2>
        {receipts && receipts.filter(r => r.loanId === loan.id).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full rounded-xl overflow-hidden shadow divide-y divide-gray-200">
              <thead className="bg-indigo-50">
                {loan.paymentType === 'interest_only' ? (
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Nº Recibo</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Data do Pagamento</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Valor Pago</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Ações</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Nº Recibo</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Ações</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {(() => {
                  const recibos = receipts.filter(r => r.loanId === loan.id);
                  return recibos.map((receipt, idx) => {
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                    if (loan.paymentType === 'interest_only') {
                      return (
                        <tr key={receipt.id} className={`${rowBg} hover:bg-indigo-50 transition`}>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold">{receipt.receiptNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{new Date(receipt.date).toLocaleDateString('pt-BR')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-green-700 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receipt.amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                            <button
                              onClick={() => {
                                const reciboData = {
                                  docNumero: receipt.receiptNumber,
                                  cliente: client.name,
                                  vencimento: loan.dueDate ? format(new Date(loan.dueDate + 'T00:00:00'), 'dd/MM/yyyy') : '-',
                                  valorPagoHoje: receipt.amount,
                                  dataGeracao: new Date(),
                                  dataPagamento: receipt.date ? new Date(receipt.date) : new Date(),
                                  pagoConfirmado: 0,
                                };
                                const recibo = gerarRecibo(reciboData);
                                alert(recibo);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-semibold transition"
                              title="Ver Recibo"
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' /></svg>
                              Recibo
                            </button>
                            <button
                              onClick={() => handleSendReceiptWhatsAppFromReceipt(receipt)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 text-xs font-semibold transition"
                              title="Enviar WhatsApp"
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 12a4 4 0 01-8 0 4 4 0 018 0zm0 0v1a4 4 0 01-8 0v-1m8 0a4 4 0 01-8 0' /></svg>
                              WhatsApp
                            </button>
                            <button
                              onClick={() => setShowDeleteReceiptModal(receipt.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold transition"
                              title="Excluir Recibo"
                            >
                              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' /></svg>
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    // Outras modalidades
                    return (
                      <tr key={receipt.id} className={`${rowBg} hover:bg-indigo-50 transition`}>
                        <td className="px-6 py-4 whitespace-nowrap">{receipt.receiptNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{new Date(receipt.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receipt.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                          <button
                            onClick={() => navigate(`/receipts/${receipt.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-semibold transition"
                            title="Ver Detalhes"
                          >
                            <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' /></svg>
                            Detalhes
                          </button>
                          <button
                            onClick={() => handleSendReceiptWhatsAppFromReceipt(receipt)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 text-xs font-semibold transition"
                            title="Enviar WhatsApp"
                          >
                            <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 12a4 4 0 01-8 0 4 4 0 018 0zm0 0v1a4 4 0 01-8 0v-1m8 0a4 4 0 01-8 0' /></svg>
                            WhatsApp
                          </button>
                          <button
                            onClick={() => setShowDeleteReceiptModal(receipt.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold transition"
                            title="Excluir Recibo"
                          >
                            <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' /></svg>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500">Nenhum recibo gerado</p>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-200 animate-fade-in">
            <div className="flex items-center mb-6 gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600">
                <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>
              </span>
              <h3 className="text-2xl font-bold text-gray-900">Registrar Pagamento</h3>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Selecione o vencimento</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                  value={selectedDueDate}
                  onChange={e => setSelectedDueDate(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {(() => {
                    const vencimentos = getVencimentos(loan, receipts);
                    const datasPagas = receipts.filter(r => r.loanId === loan.id && r.dueDate).map(r => r.dueDate.slice(0,10));
                    return vencimentos.map((data) => {
                      let dataObj = data instanceof Date ? data : (typeof data === 'string' && (data as string).length === 10 ? new Date(data + 'T12:00:00') : new Date(data));
                      const dataStr = dataObj.toISOString().slice(0,10);
                      if (datasPagas.includes(dataStr)) return null;
                      return <option key={dataStr} value={dataStr}>{dataObj.toLocaleDateString('pt-BR')}</option>;
                    });
                  })()}
                </select>
              </div>
              {loan.paymentType === 'interest_only' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Pagamento</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                    value={selectedInstallment === 2 ? 'full' : 'interest_only'}
                    onChange={e => setSelectedInstallment(e.target.value === 'full' ? 2 : 1)}
                  >
                    <option value="interest_only">Juros</option>
                    <option value="full">Juros + Capital</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor do Pagamento</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="Digite o valor"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Pagamento</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                  value={customPaymentDate}
                  onChange={e => setCustomPaymentDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <span className="text-xs text-gray-500">Se não informado, será usada a data de hoje.</span>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => { setShowPaymentModal(false); setCustomPaymentDate(''); }}
                className="px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700 font-semibold hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handlePayment();
                  setShowPaymentModal(false);
                  setCustomPaymentDate('');
                }}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold shadow hover:bg-indigo-700 transition"
              >
                <span className="inline-flex items-center gap-2">
                  <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' /></svg>
                  Confirmar Pagamento
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ...existing code... */}

      {/* Delete Receipt Modal */}
      {showDeleteReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-lg font-medium">Excluir Recibo</h3>
            </div>
            <p className="text-gray-500 mb-4">
              Tem certeza que deseja excluir este recibo? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteReceiptModal(null)}
                className="btn bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (showDeleteReceiptModal) deleteReceipt(showDeleteReceiptModal);
                  setShowDeleteReceiptModal(null);
                }}
                className="btn btn-danger"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar vencimento */}
      {showEditDueDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Alterar Data de Vencimento</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Data de Vencimento</label>
              <input
                type="date"
                className="form-input w-full"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setShowEditDueDate(false)}
                disabled={savingDueDate}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveDueDate}
                disabled={savingDueDate || !newDueDate}
              >
                {savingDueDate ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}