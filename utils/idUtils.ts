export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

export const generateInvoiceNumber = (count: number): string => {
  const year = new Date().getFullYear();
  return `INV-${year}-${(count + 1).toString().padStart(4, '0')}`;
};

export const generateReceiptNumber = (count: number, type: 'income' | 'expense'): string => {
  const prefix = type === 'income' ? 'REC' : 'EXP';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${(count + 1).toString().padStart(4, '0')}`;
};
