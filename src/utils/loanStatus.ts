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
    const pagamentos = payments?.filter(p => p.loanId === loan.id) || [];
    const quitado = pagamentos.some(p => p.type === 'full');
    return quitado ? 'completed' : 'active';
  }

  // Modalidade parcelado e diário: concluído se todas as parcelas estiverem pagas
  if (loan.paymentType === 'installments' || loan.paymentType === 'diario') {
    const totalParcelas = loan.installments || loan.numberOfInstallments || 0;
    const dataInicio = loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null);
    if (!dataInicio || totalParcelas === 0) return 'active';
    // Gera todas as datas de vencimento
    let datasVenc = [];
    if (loan.paymentType === 'diario') {
      for (let i = 0; i < totalParcelas; i++) {
        let d = new Date(dataInicio);
        d.setDate(d.getDate() + i);
        datasVenc.push(d);
      }
    } else {
      for (let i = 0; i < totalParcelas; i++) {
        let d = new Date(dataInicio);
        const diaOriginal = d.getDate();
        d.setMonth(d.getMonth() + i);
        if (d.getDate() !== diaOriginal) {
          d.setDate(0);
        }
        datasVenc.push(d);
      }
    }
    // Verifica recibos pagos
    const recibosPagos = receipts || [];
    let todasPagas = true;
    let vencidaSemPagamento = false;
    const hojeStr = new Date().toISOString().slice(0,10);
    for (let i = 0; i < datasVenc.length; i++) {
      const dataObj = datasVenc[i];
      // Garante comparação só por dia, ignorando hora/fuso
      const dataStr = dataObj.toISOString().slice(0,10);
      const pago = recibosPagos.some(r => {
        if (!r.dueDate) return false;
        const rDueDate = new Date(r.dueDate);
        const rDueDateStr = rDueDate.toISOString().slice(0,10);
        return rDueDateStr === dataStr;
      });
      if (!pago) {
        todasPagas = false;
        // Compara datas como string YYYY-MM-DD
        if (dataStr < hojeStr) {
          vencidaSemPagamento = true;
        }
      }
    }
    // Ajuste: se for 1 parcela e ela está paga, também é concluído
    if (todasPagas || (totalParcelas === 1 && recibosPagos.length > 0)) return 'completed';
    if (vencidaSemPagamento) return 'overdue';
    return 'active';
  }

  // Para as demais modalidades, considera recibos
  const recibosDoEmprestimo = receipts.filter((r) => r.loanId === loan.id);
  const totalRecibos = recibosDoEmprestimo.reduce((sum, r) => sum + (r.amount || 0), 0);
  if (recibosDoEmprestimo.length > 0 && totalRecibos >= totalComJuros) {
    return 'completed';
  }
  return 'active';

  // Para status de cada recibo, a lógica deve ser aplicada na tela de detalhes
  // Exemplo para cada recibo:
  // - Se o recibo for o último e o total recebido >= totalComJuros, status = 'concluído'
  // - Senão, status = 'ativo'
}
