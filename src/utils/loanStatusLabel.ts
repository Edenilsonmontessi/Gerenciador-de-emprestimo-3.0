// Mapeamento de status para exibição amigável e cor
export function getLoanStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Ativo', color: 'bg-blue-100 text-blue-800' };
    case 'completed':
      return { label: 'Concluído', color: 'bg-green-100 text-green-800' };
    case 'overdue':
      return { label: 'Inadimplente', color: 'bg-red-100 text-red-800' };
    default:
      return { label: status, color: 'bg-gray-100 text-gray-800' };
  }
}
