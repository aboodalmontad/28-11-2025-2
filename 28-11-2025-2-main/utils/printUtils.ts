export const triggerPrint = () => {
  window.print();
};

export const printElement = (elementIdOrHtml: string | HTMLElement, callback?: any) => {
  window.print();
  if (callback && typeof callback === 'function') {
    try {
      callback("تمت الطباعة بنجاح");
    } catch (e) {}
  }
};
