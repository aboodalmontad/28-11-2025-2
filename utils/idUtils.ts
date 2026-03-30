
export const generateId = (prefix?: string): string => {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}-${id}` : id;
};
