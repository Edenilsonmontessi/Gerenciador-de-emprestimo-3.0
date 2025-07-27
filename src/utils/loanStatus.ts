// Função para obter resumo das parcelas: pagas, vencidas, em dia
import { Loan, Receipt } from '../types';

export function getInstallmentsSummary(loan: Loan, receipts: Receipt[] = []) {
  const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
  const dataBase = loan.dueDate ? new Date(loan.dueDate) : (loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null));
  if (!dataBase || totalParcelas === 0) return { pagas: 0, vencidas: 0, emDia: 0, datasPagas: [], datasVencidas: [] };
  let datasVenc = [];
  if (loan.paymentType === 'diario') {
    for (let i = 0; i < totalParcelas; i++) {
      let d = new Date(dataBase);
      d.setDate(d.getDate() + i);
      datasVenc.push(d);
    }
  } else {
    for (let i = 0; i < totalParcelas; i++) {
      let d = new Date(dataBase);
      const diaOriginal = d.getDate();
      d.setMonth(d.getMonth() + i);
      if (d.getDate() !== diaOriginal) {
        d.setDate(0);
      }
      datasVenc.push(d);
    }
  }
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  let pagas = 0, vencidas = 0, emDia = 0;
  const datasPagas: string[] = [];
  const datasVencidas: string[] = [];
  for (let i = 0; i < datasVenc.length; i++) {
    const dataObj = datasVenc[i];
    dataObj.setHours(0,0,0,0);
    const reciboPago = receipts.find(r => {
      if (!r.dueDate) return false;
      const rDueDate = new Date(r.dueDate);
      rDueDate.setHours(0,0,0,0);
      return (
        rDueDate.getFullYear() === dataObj.getFullYear() &&
        rDueDate.getMonth() === dataObj.getMonth() &&
        rDueDate.getDate() === dataObj.getDate()
      );
    });
    if (reciboPago) {
      pagas++;
      // Usa a data do recibo pago
      datasPagas.push(new Date(reciboPago.dueDate).toLocaleDateString('pt-BR'));
    } else if (dataObj < hoje) {
      vencidas++;
      datasVencidas.push(dataObj.toLocaleDateString('pt-BR'));
    } else {
      emDia++;
    }
  }
  return { pagas, vencidas, emDia, datasPagas, datasVencidas };
}
// Função utilitária para calcular status do empréstimo
import { Loan, Receipt, Payment } from '../types';

export function getLoanStatus(
  loan: Loan,
  receipts: Receipt[] = [],
  payments: Payment[] = []
): 'active' | 'completed' | 'overdue' {
  // Garante comparação de datas apenas por dia (ignorando hora)
  const today = new Date();
  today.setHours(0,0,0,0);
  const dueDate = loan.dueDate ? new Date(loan.dueDate) : null;
  if (dueDate) dueDate.setHours(0,0,0,0);
  // Soma todos os valores recebidos (recibos e pagamentos) referentes ao empréstimo
  const totalRecebido = [
    ...receipts.filter((r) => r.loanId === loan.id).map(r => r.amount || 0),
    ...payments.filter((p) => p.loanId === loan.id).map(p => p.amount || 0)
  ].reduce((sum, value) => sum + value, 0);

  // Ajuste: saldo a receber por modalidade
  let saldoAReceber = 0;
  if (loan.paymentType === 'interest_only') {
    const quitado = payments?.some(p => p.type === 'full');
    saldoAReceber = quitado ? 0 : loan.totalAmount;
  } else if (loan.paymentType === 'diario') {
    const quitado = payments?.some(p => p.type === 'full');
    saldoAReceber = quitado ? 0 : Math.max((loan.installments && loan.installmentAmount)
      ? loan.installments * loan.installmentAmount - totalRecebido
      : loan.totalAmount - totalRecebido, 0);
  } else {
    saldoAReceber = Math.max((loan.installments && loan.installmentAmount)
      ? loan.installments * loan.installmentAmount - totalRecebido
      : loan.totalAmount - totalRecebido, 0);
  }

  // Só marca como concluído se o total pago for igual ao total com juros
  const totalComJuros = ((loan.paymentType === 'diario' || loan.paymentType === 'installments') && loan.installments && loan.installmentAmount)
    ? loan.installments * loan.installmentAmount
    : loan.totalAmount;

  // Lógica para status dos recibos individuais
  // Se o total recebido for igual ou maior ao total com juros, empréstimo está concluído
  // Na modalidade 'somente juros', só conclui se houver pagamento do tipo 'full'


  // Modalidade somente juros: concluído apenas se houver pagamento tipo 'full' (juros + capital)
  if (loan.paymentType === 'interest_only') {
    const quitado = payments?.filter(p => p.loanId === loan.id).some(p => p.type === 'full');
    return quitado ? 'completed' : 'active';
  }

  // Modalidade parcelado e diário: concluído se todas as parcelas estiverem pagas
  if (loan.paymentType === 'installments' || loan.paymentType === 'diario') {
    const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
    const recibosPagos = (receipts || []).filter(r => r.loanId === loan.id && r.amount > 0);
    // Se o número de recibos pagos for igual ao número de parcelas, considera concluído
    if (recibosPagos.length >= totalParcelas && totalParcelas > 0) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('[DEBUG loanStatus] Todas as parcelas pagas! Empréstimo concluído (tolerante a datas).', { loanId: loan.id });
      }
      return 'completed';
    }
    // Lógica antiga (datas exatas) como fallback para mostrar overdue
    const dataBase = loan.dueDate ? new Date(loan.dueDate) : (loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null));
    const customDates = (loan as any).customDates || {};
    if (!dataBase || totalParcelas === 0) return 'active';
    let datasVenc = [];
    for (let i = 0; i < totalParcelas; i++) {
      if (customDates && customDates[i + 1]) {
        datasVenc.push(new Date(customDates[i + 1] + 'T12:00:00'));
      } else if (loan.paymentType === 'diario') {
        let d = new Date(dataBase);
        d.setDate(d.getDate() + i);
        datasVenc.push(d);
      } else {
        let d = new Date(dataBase);
        const diaOriginal = d.getDate();
        d.setMonth(d.getMonth() + i);
        if (d.getDate() !== diaOriginal) {
          d.setDate(0);
        }
        datasVenc.push(d);
      }
    }
    let todasPagas = true;
    let vencidaSemPagamento = false;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    for (let i = 0; i < datasVenc.length; i++) {
      const dataObj = datasVenc[i];
      dataObj.setHours(0,0,0,0);
      const pago = recibosPagos.some(r => {
        if (!r.dueDate) return false;
        const rDate = new Date(r.dueDate);
        rDate.setHours(0,0,0,0);
        if (
          rDate.getFullYear() === dataObj.getFullYear() &&
          rDate.getMonth() === dataObj.getMonth() &&
          rDate.getDate() === dataObj.getDate()
        ) {
          return true;
        }
        if (r.loanId === loan.id && r.amount === loan.installmentAmount) {
          const diff = Math.abs(rDate.getTime() - dataObj.getTime());
          if (diff <= 1000 * 60 * 60 * 24) return true;
        }
        return false;
      });
      if (!pago) {
        todasPagas = false;
        if (dataObj < hoje) {
          vencidaSemPagamento = true;
        }
        if (typeof window !== 'undefined' && window.console) {
          window.console.log('[DEBUG loanStatus] Parcela NÃO paga:', {
            dataEsperada: dataObj,
            datasVenc,
            recibosPagos,
            loanId: loan.id,
            installmentAmount: loan.installmentAmount,
            customDates
          });
        }
      } else {
        if (typeof window !== 'undefined' && window.console) {
          window.console.log('[DEBUG loanStatus] Parcela paga:', {
            dataEsperada: dataObj,
            datasVenc,
            recibosPagos,
            loanId: loan.id,
            installmentAmount: loan.installmentAmount,
            customDates
          });
        }
      }
    }
    if (todasPagas) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('[DEBUG loanStatus] Todas as parcelas pagas! Empréstimo concluído.', { loanId: loan.id });
      }
      return 'completed';
    }
    if (vencidaSemPagamento) return 'overdue';
    return 'active';
  }

  // Outras modalidades: manter lógica padrão (pode ser ajustada conforme necessidade)
  return 'active';

  // Para status de cada recibo, a lógica deve ser aplicada na tela de detalhes
  // Exemplo para cada recibo:
  // - Se o recibo for o último e o total recebido >= totalComJuros, status = 'concluído'
  // - Senão, status = 'ativo'
}
