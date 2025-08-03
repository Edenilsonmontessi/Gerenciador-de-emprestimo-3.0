import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLocalData } from '../contexts/SupabaseContext';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { addDays } from 'date-fns';

type LoanFormData = {
  clientId: string;
  amount: number;
  interestRate: number;
  paymentType: 'installments' | 'interest_only' | 'diario';
  numberOfInstallments: number;
  installmentValues: number[];
  dueDate: string;
  notes?: string;
};

// Função utilitária para data local no formato YYYY-MM-DD
function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AddLoan() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clients, addLoan } = useLocalData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState<'installments' | 'interest_only' | 'diario'>('installments');
  const [numberOfInstallments, setNumberOfInstallments] = useState(1);
  // Ajusta o tipo para string[] para facilitar o controle dos inputs
  const [installmentValues, setInstallmentValues] = useState<string[]>([]);
  const [interestAmount, setInterestAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customDueDate, setCustomDueDate] = useState<string>("");

  const queryParams = new URLSearchParams(location.search);
  const clientIdParam = queryParams.get('clientId');

  // Corrigir o cálculo da data de vencimento para evitar subtração incorreta de um dia
  const defaultDueDate = addDays(new Date(), 30);
  const defaultDueDateString = defaultDueDate.toISOString().split('T')[0];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoanFormData>({
    defaultValues: {
      clientId: clientIdParam || '',
      dueDate: defaultDueDateString,
      interestRate: 25,
      numberOfInstallments: 1,
      installmentValues: []
    }
  });

  const watchAmount = watch('amount');
  const watchInterestRate = watch('interestRate');

  useEffect(() => {
    if (watchAmount && watchInterestRate) {
      const amount = Number(watchAmount);
      const rate = Number(watchInterestRate) / 100;
      if (paymentType === 'installments') {
        const totalWithInterest = amount * (1 + rate);
        setTotalAmount(totalWithInterest);
        // Initialize installment values as empty strings for user input
        const newInstallments = Array(numberOfInstallments).fill('');
        setInstallmentValues(newInstallments);
      } else {
        const interest = amount * rate;
        setInterestAmount(interest);
        setTotalAmount(amount + interest);
      }
    }
  }, [watchAmount, watchInterestRate, paymentType, numberOfInstallments]);

  useEffect(() => {
    // Para Parcelado e Somente Juros, sugere 30 dias à frente
    if (paymentType === 'installments' || paymentType === 'interest_only') {
      let baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 30);
      setCustomDueDate(baseDate.toISOString().split('T')[0]);
    }
    // Para Diário, não mostra campo de data
  }, [paymentType, numberOfInstallments]);

  const handleInstallmentChange = (index: number, value: string) => {
    const newInstallments = [...installmentValues];
    newInstallments[index] = value;
    setInstallmentValues(newInstallments);
    setTotalAmount(newInstallments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0));
  };

  const onSubmit = async (data: LoanFormData) => {
    setIsSubmitting(true);
    try {
      const today = new Date();
      let dueDate: string = '';
      let endDate: string = '';
      if (paymentType === 'installments' || paymentType === 'interest_only') {
        // Salva apenas 'YYYY-MM-DD' para evitar problemas de fuso horário
        dueDate = customDueDate ? customDueDate : '';
        endDate = customDueDate ? customDueDate : '';
      } else if (paymentType === 'diario') {
        // Calcula a data final (último dia do empréstimo diário)
        const base = new Date();
        base.setHours(0,0,0,0);
        base.setDate(base.getDate() + numberOfInstallments - 1); // Corrigido: subtrai 1 para alinhar com o input
        dueDate = formatDateLocal(base);
        endDate = formatDateLocal(base);
      }

      // Monta o objeto com todos os campos obrigatórios para o Supabase
      const loan = {
        clientId: data.clientId,
        amount: Number(data.amount),
        interestRate: Number(data.interestRate),
        totalAmount: totalAmount || Number(data.amount),
        installments: paymentType === 'installments' ? numberOfInstallments : paymentType === 'diario' ? numberOfInstallments : 1,
        installmentAmount: paymentType === 'installments' ? (totalAmount || Number(data.amount)) / numberOfInstallments : paymentType === 'diario' ? (installmentValues[0] ? parseFloat(installmentValues[0]) : 0) : (totalAmount || Number(data.amount)),
        startDate: today.toISOString(),
        endDate,
        dueDate,
        status: "active" as const,
        paymentType: paymentType,
        notes: data.notes || undefined,
        createdAt: today.toISOString()
      };
      const newLoan = await addLoan(loan);
      if (newLoan) {
        navigate('/loans');
      } else {
        alert('Erro ao registrar empréstimo. Verifique os campos obrigatórios e tente novamente.');
      }
    } catch (error: any) {
      alert('Erro ao registrar empréstimo: ' + (error?.message || error));
      console.error('Error adding loan:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 md:px-6 py-6">
      <div className="mb-8 flex items-center gap-3">
        <button 
          onClick={() => navigate('/loans')}
          className="text-gray-500 hover:text-indigo-600 flex items-center rounded-full p-2 bg-indigo-50 shadow"
        >
          <ArrowLeft size={22} className="mr-1" />
        </button>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm">Novo Empréstimo</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label htmlFor="clientId" className="form-label font-semibold flex items-center gap-2"><span className='text-indigo-600'>👤</span>Cliente</label>
                  <select
                    id="clientId"
                    className={`form-input rounded-lg shadow-sm ${errors.clientId ? 'border-red-300' : ''}`}
                    {...register('clientId', { required: 'Cliente é obrigatório' })}
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.code ? ` (Cód: ${client.code})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.clientId && <p className="mt-1 text-sm text-red-600">{errors.clientId.message}</p>}
                </div>
                <div>
                  <label htmlFor="amount" className="form-label font-semibold flex items-center gap-2"><span className='text-green-600'>💰</span>Valor do Empréstimo (R$)</label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    className={`form-input rounded-lg shadow-sm ${errors.amount ? 'border-red-300' : ''}`}
                    {...register('amount', { required: 'Valor do empréstimo é obrigatório' })}
                  />
                  {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
                </div>
                <div>
                  <label htmlFor="interestRate" className="form-label font-semibold flex items-center gap-2"><span className='text-purple-600'>%</span>Taxa de Juros (% ao mês)</label>
                  <input
                    type="number"
                    id="interestRate"
                    step="0.1"
                    min="0"
                    className={`form-input rounded-lg shadow-sm ${errors.interestRate ? 'border-red-300' : ''}`}
                    {...register('interestRate', { 
                      required: 'Taxa de juros é obrigatória',
                      min: { value: 0, message: 'Taxa de juros deve ser positiva' },
                      valueAsNumber: true
                    })}
                  />
                  {errors.interestRate && <p className="mt-1 text-sm text-red-600">{errors.interestRate.message}</p>}
                </div>
                <div>
                  <label className="form-label font-semibold flex items-center gap-2"><span className='text-blue-600'>💳</span>Forma de Pagamento</label>
                  <select 
                    className="form-input rounded-lg shadow-sm"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as 'installments' | 'interest_only' | 'diario')}
                  >
                    <option value="installments">Parcelado</option>
                    <option value="interest_only">Somente Juros</option>
                    <option value="diario">Diário</option>
                  </select>
                </div>
                {paymentType !== 'diario' && (
                  <div>
                    <label className="form-label font-semibold flex items-center gap-2"><span className='text-orange-600'>📅</span>Data de Vencimento</label>
                    <input
                      type="date"
                      className="form-input rounded-lg shadow-sm"
                      value={customDueDate}
                      onChange={e => setCustomDueDate(e.target.value)}
                      required
                    />
                  </div>
                )}
                {paymentType === 'installments' && (
                  <div>
                    <label className="form-label font-semibold flex items-center gap-2"><span className='text-pink-600'>#️⃣</span>Número de Parcelas</label>
                    <select 
                      className="form-input rounded-lg shadow-sm"
                      value={numberOfInstallments}
                      onChange={(e) => setNumberOfInstallments(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num}x</option>
                      ))}
                    </select>
                  </div>
                )}
                {paymentType === 'diario' && (
                  <>
                    <div>
                      <label className="form-label font-semibold flex items-center gap-2"><span className='text-pink-600'>#️⃣</span>Quantidade de Dias (Parcelas)</label>
                      <input
                        type="number"
                        className="form-input rounded-lg shadow-sm"
                        min={1}
                        value={numberOfInstallments || ''}
                        onChange={(e) => {
                          const qtdParcelas = e.target.value ? Number(e.target.value) : 0;
                          setNumberOfInstallments(qtdParcelas);
                          const valorParcela = installmentValues[0] ? parseFloat(installmentValues[0]) : 0;
                          if (valorParcela > 0 && qtdParcelas > 0) {
                            setTotalAmount(qtdParcelas * valorParcela);
                          } else {
                            setTotalAmount(0);
                          }
                        }}
                        placeholder="Digite a quantidade de dias"
                      />
                    </div>
                    <div>
                      <label className="form-label font-semibold flex items-center gap-2"><span className='text-green-600'>💸</span>Valor de Cada Parcela (R$)</label>
                      <input
                        type="number"
                        className="form-input rounded-lg shadow-sm"
                        step="0.01"
                        value={installmentValues[0] || ''}
                        onChange={(e) => {
                          const valorParcela = e.target.value ? parseFloat(e.target.value) : 0;
                          setInstallmentValues([e.target.value]);
                          if (valorParcela > 0 && numberOfInstallments > 0) {
                            setTotalAmount(numberOfInstallments * valorParcela);
                          } else {
                            setTotalAmount(0);
                          }
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label htmlFor="notes" className="form-label font-semibold flex items-center gap-2"><span className='text-gray-500'>📝</span>Observações</label>
                  <textarea
                    id="notes"
                    rows={3}
                    className="form-input rounded-lg shadow-sm"
                    {...register('notes')}
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => navigate('/loans')}
                  className="px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700 font-semibold hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || clients.length === 0}
                  className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold shadow hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <Save size={18} />
                  {isSubmitting ? 'Salvando...' : 'Registrar Empréstimo'}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div>
          <div className="bg-gradient-to-br from-indigo-50 to-purple-100 shadow-xl rounded-2xl p-8 border border-indigo-100">
            <div className="flex items-center mb-6 gap-2">
              <Calculator className="h-6 w-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Simulação do Empréstimo</h2>
            </div>
            <div className="space-y-6">
              {paymentType === 'installments' ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Valores das Parcelas:</h3>
                  {installmentValues.map((amount, index) => (
                    <div key={index} className="flex items-center gap-4 py-2 border-b border-gray-100">
                      <span className="w-8 font-bold text-indigo-600">{index + 1}x</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => handleInstallmentChange(index, e.target.value)}
                        className="form-input flex-1 rounded-lg shadow-sm"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                      />
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-extrabold text-indigo-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : paymentType === 'diario' ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Empréstimo Diário</h3>
                  <p className="text-base font-medium text-gray-900">
                    O valor e o número de pagamentos diários serão registrados conforme os pagamentos forem feitos. O empréstimo permanece em aberto até a quitação total.
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-extrabold text-indigo-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Pagamento Mensal de Juros:</h3>
                  <p className="text-lg font-bold text-purple-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(interestAmount)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    + Capital de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(watchAmount))} ao final
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-extrabold text-indigo-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {paymentType === 'diario' && (
                <div>
                  <h3 className="form-label font-semibold">Datas de Vencimento Diárias</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                    {Array.from({ length: numberOfInstallments }, (_, index) => {
                      const dueDate = addDays(new Date(), index + 1);
                      return (
                        <li key={index}>
                          Parcela {index + 1}: {dueDate.toLocaleDateString('pt-BR')}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}