export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:       { label: '⏳ მოლოდინი',    color: '#f59e0b' },
  accepted:      { label: '✅ მიღებული',    color: '#10b981' },
  rejected:      { label: '❌ უარყოფილი',   color: '#ef4444' },
  'in-transit':  { label: '🚚 გზაში',       color: '#3b82f6' },
  'in-progress': { label: '🚛 მიმდინარე',   color: '#0ea5e9' },
  delivered:     { label: '📍 ჩაბარებული',  color: '#8b5cf6' },
  active:        { label: '🚗 აქტიური',     color: '#10b981' },
  completed:     { label: '✅ დასრულებული', color: '#3b82f6' },
  cancelled:     { label: '🚫 გაუქმებული',  color: '#ef4444' }
};

export function statusMeta(status?: string): { label: string; color: string } {
  return STATUS_META[status || ''] || { label: status || '—', color: '#6b7280' };
}

export const ROLE_LABELS: Record<string, string> = {
  sender: '📦 გამგზავნი',
  driver: '🚗 მძღოლი',
  admin: '🛡 ადმინი'
};

export const REQUEST_STATUSES = ['pending', 'accepted', 'in-transit', 'delivered', 'cancelled'];
export const TRIP_STATUSES = ['pending', 'active', 'in-progress', 'completed', 'cancelled'];

/** populate-ებული ან ჩვეულებრივი ref-იდან სახელის ამოღება */
export function personName(ref: any): string {
  if (!ref || typeof ref === 'string') return '—';
  return `${ref.firstName || ''} ${ref.lastName || ''}`.trim() || '—';
}
export function personPhone(ref: any): string {
  return ref && typeof ref !== 'string' ? ref.phone || '—' : '—';
}
