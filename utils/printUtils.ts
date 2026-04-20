export const printElement = (element: HTMLElement | null, showFeedback?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void) => {
    if (!element) {
        console.error("Print Error: Provided element is null.");
        return;
    }

    try {
        const printWindow = window.open('', '_blank', 'height=800,width=1000');
        
        if (!printWindow) {
            if (showFeedback) {
                showFeedback("يرجى السماح بالنوافذ المنبثقة في متصفحك لتمكين الطباعة.", "warning");
            }
            return;
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(style => style.outerHTML)
            .join('');

        const doc = printWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>طباعة تقرير</title>
                ${styles}
            </head>
            <body>
                ${element.innerHTML}
            </body>
            </html>
        `);
        doc.close();

        // Use a timeout to ensure styles are loaded before printing
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            
            // Close the window after printing
            setTimeout(() => {
                printWindow.close();
            }, 2000);
        }, 1000);
    } catch (error) {
        console.error("Print Error:", error);
        if (showFeedback) {
            showFeedback("حدث خطأ أثناء الطباعة. يرجى المحاولة مرة أخرى.", "error");
        }
    }
};
