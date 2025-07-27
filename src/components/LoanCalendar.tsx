import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useNavigate } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';
import type { Loan } from '../types';

// Função para gerar lista de vencimentos igual LoanDetail, considerando datas customizadas por parcela
function getVencimentos(
  loan: Loan,
  receipts: { loanId: string; date?: string; amount?: number }[]
): Date[] {
  let datas: Date[] = [];
  let totalParcelas = loan.installments || loan.numberOfInstallments || 0;
  let dataBase: Date | null = null;
  // Suporte a datas customizadas por parcela (campo customDates)
  const customDates: Record<number, string> = (loan as any).customDates || {};
  if (loan.paymentType === 'diario') {
    dataBase = loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null);
    if (!dataBase) return [];
    for (let i = 0; i < totalParcelas; i++) {
      if (customDates && customDates[i + 1]) {
        datas.push(new Date(customDates[i + 1] + 'T12:00:00'));
      } else {
        let d = new Date(dataBase);
        d.setDate(d.getDate() + i);
        datas.push(d);
      }
    }
  } else if (loan.paymentType === 'interest_only') {
    dataBase = loan.dueDate ? new Date(loan.dueDate + 'T12:00:00') : null;
    if (!dataBase) return [];
    // Sempre gera as datas de vencimento normalmente, independente do status
    const pagamentosDoEmprestimo = loan.payments || [];
    const quitado = pagamentosDoEmprestimo.some(p => p.type === 'full');
    const qtd = receipts.filter(r => r.loanId === loan.id).length;
    let limite = qtd + 1;
    if (quitado) {
      // Se quitado, só gera vencimentos até o último recibo (não gera o próximo)
      limite = qtd;
    }
    for (let i = 0; i < limite; i++) {
      if (customDates && customDates[i + 1]) {
        datas.push(new Date(customDates[i + 1] + 'T12:00:00'));
      } else {
        let d = new Date(dataBase);
        const diaOriginal = d.getDate();
        d.setMonth(d.getMonth() + i);
        if (d.getDate() !== diaOriginal) {
          d.setDate(0);
        }
        datas.push(d);
      }
    }
  } else {
    dataBase = loan.dueDate ? new Date(loan.dueDate + 'T12:00:00') : (loan.startDate ? new Date(loan.startDate) : (loan.createdAt ? new Date(loan.createdAt) : null));
    if (!dataBase) return [];
    for (let i = 0; i < totalParcelas; i++) {
      if (customDates && customDates[i + 1]) {
        datas.push(new Date(customDates[i + 1] + 'T12:00:00'));
      } else {
        let d = new Date(dataBase);
        const diaOriginal = d.getDate();
        d.setMonth(d.getMonth() + i);
        if (d.getDate() !== diaOriginal) {
          d.setDate(0);
        }
        datas.push(d);
      }
    }
  }
  return datas;
}

// Função utilitária para atualizar o status do empréstimo
function getUpdatedStatus(newDueDate: string) {
  return dayjs(newDueDate).isAfter(dayjs(), 'day') ? 'active' : 'defaulted';
}

export default function LoanCalendar() {

  console.log('[LoanCalendar] Componente carregado');
  const { loans, clients, receipts, updateLoan, refetchLoans } = useLocalData();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editLoan, setEditLoan] = useState<null | { loan: Loan, parcelaNumero?: number }>(null);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  // Loga sempre que o modal de edição for aberto
  useEffect(() => {
    if (editLoan) {
      console.log('[LoanCalendar] Modal de edição aberto para loanId:', editLoan.loan.id);
    }
  }, [editLoan]);

  // Sempre que loans ou receipts mudarem, força atualização do calendário
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [loans, receipts]);

  // Gera um Set com todas as datas de vencimento reais de todos os empréstimos (usando getVencimentos)
  const loanDueDates = new Set<string>();
  const parcelasPorData: Record<string, Array<{loan: Loan, parcelaNumero?: number}>> = {};
  loans.forEach(loan => {
    // Inclui todos os vencimentos, mesmo sem recibo, para 'somente juros'
    const isCompleted = loan.status === 'completed';
    const vencimentos = getVencimentos(loan, receipts || []);
    let hasOverdue = false;
    vencimentos.forEach((data, idx) => {
      const dataStr = dayjs(data).format('YYYY-MM-DD');
      loanDueDates.add(dataStr);
      if (!parcelasPorData[dataStr]) parcelasPorData[dataStr] = [];
      let parcelaNumero: number | undefined = undefined;
      if (loan.paymentType === 'installments' || loan.paymentType === 'diario' || loan.paymentType === 'interest_only') {
        parcelaNumero = idx + 1;
      }
      parcelasPorData[dataStr].push({ loan, parcelaNumero });
      // Verifica se está vencida e não paga, mas só se não estiver concluído
      if (!isCompleted) {
        if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && parcelaNumero) {
          const recibosPagos = (receipts || []).filter(r => r.loanId === loan.id);
          const pago = recibosPagos.length >= parcelaNumero;
          if (!pago && dayjs(dataStr).isBefore(dayjs(), 'day')) {
            hasOverdue = true;
          }
        } else if (loan.paymentType === 'interest_only' && parcelaNumero) {
          // Para cada vencimento, verifica se há recibo para aquela data
          const dataVencStr = dayjs(data).format('YYYY-MM-DD');
          const reciboPago = (receipts || []).some(r => r.loanId === loan.id && r.date && dayjs(r.date).format('YYYY-MM-DD') === dataVencStr);
          if (!reciboPago && dayjs(dataVencStr).isBefore(dayjs(), 'day')) {
            hasOverdue = true;
          }
        }
      }
    });
    // Atualiza status para 'defaulted' se houver vencida não paga
    if (hasOverdue && loan.status !== 'defaulted' && updateLoan) {
      updateLoan(loan.id, { status: 'defaulted' });
    }
  });

  // Para o dia selecionado, pega todos os empréstimos/parcelas que vencem nesse dia
  const loansForDay = selectedDate
    ? (parcelasPorData[dayjs(selectedDate).format('YYYY-MM-DD')] || [])
    : [];

  // Soma o valor correto devido do dia: parcela, valor diário ou juros do dia
  const totalDoDia = loansForDay.reduce((acc, item) => {
    const loan = item.loan;
    const parcelaNumero = item.parcelaNumero;
    let dataParcela: Date | null = null;
    if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && parcelaNumero) {
      const vencimentos = getVencimentos(loan, receipts || []);
      dataParcela = vencimentos[parcelaNumero - 1] || null;
    } else if (loan.paymentType === 'interest_only' && parcelaNumero) {
      const vencimentos = getVencimentos(loan, receipts || []);
      dataParcela = vencimentos[parcelaNumero - 1] || null;
    }
    let quitado = false;
    if (loan.status === 'completed') {
      quitado = true;
    } else if (dataParcela && parcelaNumero) {
      const dataVenc = dayjs(dataParcela).startOf('day');
      if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && parcelaNumero) {
        const dataVencStr = dataVenc.format('YYYY-MM-DD');
        quitado = (receipts || []).some(r => r.loanId === loan.id && r.date && dayjs(r.date).format('YYYY-MM-DD') === dataVencStr);
      } else if (loan.paymentType === 'interest_only' && parcelaNumero) {
        const recibosPagos = (receipts || []).filter(r => r.loanId === loan.id);
        quitado = recibosPagos.length >= parcelaNumero;
      }
    }
    // Só soma se não for quitado (pago)
    if (!quitado) {
      if (loan.paymentType === 'installments' && loan.installmentAmount) {
        return acc + loan.installmentAmount;
      }
      if (loan.paymentType === 'diario' && loan.installmentAmount) {
        return acc + loan.installmentAmount;
      }
      if (loan.paymentType === 'interest_only' && loan.amount) {
        let taxa = 0;
        if (typeof loan.interestRate === 'number') {
          taxa = loan.interestRate;
        } else if (typeof loan.interestRate === 'string') {
          const match = (loan.interestRate as string).match(/([\d,.]+)/);
          if (match) taxa = parseFloat(match[1].replace(',', '.'));
        }
        const jurosSimples = loan.amount && taxa ? loan.amount * (taxa / 100) : 0;
        return acc + jurosSimples;
      }
      if (loan.installmentAmount) {
        return acc + loan.installmentAmount;
      }
      if (loan.amount) {
        return acc + loan.amount;
      }
    }
    return acc;
  }, 0);

  // Função para buscar nome do cliente pelo clientId
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : clientId;
  };

  // (Removido: já declarado acima)

  // Função utilitária para calcular juros simples para exibir no detalhe
  function renderJurosSimplesDetalhe(loan: Loan) {
    if (loan.paymentType !== 'interest_only' || !loan.amount) return null;
    const taxa = typeof loan.interestRate === 'number' ? loan.interestRate : 0;
    const jurosSimples = loan.amount && taxa ? loan.amount * (taxa / 100) : 0;
    return (
      <div className="text-sm text-blue-800 mt-1">
        Valor somente juros: <b>{jurosSimples.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
      </div>
    );
  }

  return (
    <div className="mb-8" key={refreshKey}>
      <h2 className="text-xl font-bold mb-2">Filtrar por Data de Vencimento</h2>
      <Calendar
        onChange={date => setSelectedDate(date as Date)}
        value={selectedDate}
        locale="pt-BR"
        formatShortWeekday={(_locale, date) => {
          // Ordem correta: Dom, Seg, Ter, Qua, Qui, Sex, Sáb
          const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          return dias[date.getDay()];
        }}
        formatMonthYear={(_, date) => dayjs(date).locale('pt-br').format('MMMM [de] YYYY')}
        formatMonth={(_, date) => dayjs(date).locale('pt-br').format('MMMM')}
        // Removido tileClassName para não colorir os dias
        tileClassName={undefined}
      />
      {/* Removido estilo customizado dos dias do calendário */}
      {selectedDate && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">
            Valor total devido em {dayjs(selectedDate).format('DD/MM/YYYY')}: <span className="text-blue-700">{totalDoDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </h3>
          {loansForDay.length > 0 && (
            <ul className="space-y-2">
              {loansForDay.map(({ loan, parcelaNumero }) => {
                let totalParcelas = loan.installments || loan.numberOfInstallments || 0;
                let idxParcela = parcelaNumero || 1;
                // Descobre a data da parcela/diária
                let dataParcela: Date | null = null;
                if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && parcelaNumero) {
                  const vencimentos = getVencimentos(loan, receipts || []);
                  dataParcela = vencimentos[parcelaNumero - 1] || null;
                } else if (loan.paymentType === 'interest_only' && parcelaNumero) {
                  const vencimentos = getVencimentos(loan, receipts || []);
                  dataParcela = vencimentos[parcelaNumero - 1] || null;
                }
                // Label para hoje
                let labelHoje = '';
                if (dataParcela && dayjs(dataParcela).startOf('day').isSame(dayjs().startOf('day'))) {
                  labelHoje = ' (Hoje)';
                }
                // Não marca como atrasado se já estiver concluído
                const isCompleted = loan.status === 'completed';
                // Lógica idêntica ao calendário para quitado/atrasado
                let quitado = false;
                let atrasado = false;
                if (isCompleted) {
                  quitado = true;
                } else if (dataParcela && parcelaNumero) {
                  const dataVenc = dayjs(dataParcela).startOf('day');
                  let reciboPago = false;
                  if ((loan.paymentType === 'installments' || loan.paymentType === 'diario') && parcelaNumero) {
                    // Só marca como pago se houver recibo para a data exata da parcela
                    const dataVencStr = dataVenc.format('YYYY-MM-DD');
                    reciboPago = (receipts || []).some(r => r.loanId === loan.id && r.date && dayjs(r.date).format('YYYY-MM-DD') === dataVencStr);
                  } else if (loan.paymentType === 'interest_only' && parcelaNumero) {
                    // Considera quitado se o número de recibos for igual ou maior ao número da parcela/juros
                    const recibosPagos = (receipts || []).filter(r => r.loanId === loan.id);
                    reciboPago = recibosPagos.length >= parcelaNumero;
                  }
                  quitado = reciboPago;
                  const hoje = dayjs().startOf('day');
                  atrasado = !reciboPago && !isCompleted && dataVenc.isBefore(hoje);
                }

                // Cálculo do valor do pagamento de juros para modalidade somente juros
                let jurosSimples = 0;
                if (loan.paymentType === 'interest_only') {
                  const taxa = typeof loan.interestRate === 'number' ? loan.interestRate : 0;
                  jurosSimples = loan.amount && taxa ? loan.amount * (taxa / 100) : 0;
                }

                // Define a cor do nome do empréstimo: verde para pagos, azul para abertos, vermelho para vencidos
                let nomeClasse = 'font-bold px-2 py-1 rounded cursor-pointer ';
                if (quitado) nomeClasse += 'text-green-600 hover:bg-green-100 ';
                else if (atrasado) nomeClasse += 'text-red-600 hover:bg-red-100 ';
                else nomeClasse += 'text-blue-600 hover:bg-blue-100 ';

                return (
                  <li key={loan.id + (parcelaNumero ? `-parcela${parcelaNumero}` : '')}>
                    <button
                      className={nomeClasse + 'hover:underline'}
                      onClick={() => navigate(`/loans/${loan.id}`)}
                    >
                      {getClientName(loan.clientId)}
                      {loan.paymentType === 'installments' && parcelaNumero ?
                        ` - Parcela ${idxParcela}/${totalParcelas}: ${(loan.installmentAmount || loan.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` :
                        loan.paymentType === 'diario' && parcelaNumero ?
                          ` - Valor diário: ${(loan.installmentAmount || loan.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` :
                          loan.paymentType === 'interest_only' ?
                            ` - Valor juros: ${jurosSimples.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` :
                            ` - Valor: ${(loan.totalAmount || loan.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      }
                      {labelHoje}
                      {quitado && ' (Pago)'}
                      {atrasado && ' (Atrasado)'}
                    </button>
                    {/* Exibe valor somente juros abaixo de Parcelas, se for somente juros */}
                    {loan.paymentType === 'interest_only' && (
                      renderJurosSimplesDetalhe(loan)
                    )}
                  </li>
                );
              })}
      {/* Modal para alterar data de vencimento */}
      {editLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h4 className="font-bold mb-2">Alterar Data de Vencimento</h4>
            <p className="mb-2">Cliente: <b>{getClientName(editLoan.loan.clientId)}</b></p>
            <input
              type="date"
              className="border p-2 rounded w-full mb-4"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded"
                onClick={async () => {
                  if (!editLoan) {
                    console.log('[LoanCalendar][SALVAR] editLoan está null, abortando.');
                    return;
                  }
                  const { loan, parcelaNumero } = editLoan;
                  if (!parcelaNumero) {
                    alert('Parcela não identificada.');
                    return;
                  }
                  let customDates = { ...(loan as any).customDates };
                  customDates[parcelaNumero] = newDueDate;
                  // Atualiza apenas a data da parcela específica
                  const patch: any = { customDates };
                  // Se for a primeira parcela, também atualiza dueDate principal
                  if (parcelaNumero === 1) {
                    patch.dueDate = newDueDate;
                    patch.status = getUpdatedStatus(newDueDate);
                  }
                  console.log('[LoanCalendar][SALVAR] Salvando data customizada da parcela', parcelaNumero, customDates);
                  if (typeof updateLoan === 'function') {
                    try {
                      const result = await updateLoan(loan.id, patch);
                      console.log('[LoanCalendar][SALVAR] updateLoan resultado:', result);
                      if (typeof refetchLoans === 'function') {
                        await refetchLoans();
                      }
                    } catch (err) {
                      console.error('[LoanCalendar][SALVAR] Erro ao salvar no updateLoan:', err);
                    }
                  } else {
                    console.warn('[LoanCalendar][SALVAR] updateLoan não é uma função!');
                  }
                  setEditLoan(null);
                }}
                disabled={!newDueDate}
              >Salvar</button>
              <button
                className="bg-gray-300 px-4 py-2 rounded"
                onClick={() => setEditLoan(null)}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
            </ul>
          )}
          {loansForDay.length === 0 && <p className="text-gray-500">Nenhum empréstimo com vencimento nesta data.</p>}
        </div>
      )}
    </div>
  );
}
