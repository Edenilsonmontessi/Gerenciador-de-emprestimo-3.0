

import LoanCalendar from '../components/LoanCalendar';

export default function OverdueLoans() {
  return (
    <div className="p-2 md:p-6 animate-fade-in">
      <h1 className="section-title mb-4">Empréstimos por Data de Vencimento</h1>
      <div className="card">
        <LoanCalendar />
      </div>
    </div>
  );
}