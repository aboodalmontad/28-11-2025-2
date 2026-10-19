const fs = require('fs');
let code = fs.readFileSync('pages/ActivityLogsPage.tsx', 'utf8');

// Replace top level wrapper
code = code.replace(
  /<div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-6 bg-slate-950\/80 backdrop-blur-xs flex justify-center items-start sm:items-center py-6 sm:py-10">\s*<div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl border border-gray-200 overflow-hidden my-auto">/,
  '<div className="bg-gray-50 flex flex-col h-full w-full">\n<div className="bg-white rounded-xl shadow-xs border border-gray-200 m-4 sm:m-6 overflow-hidden">'
);

// Remove the bottom div tags that corresponded to the fixed wrapper
code = code.replace(
  /      <\/div>\s*<\/div>\s*\);\s*};\s*export default ActivityLogsPage;/,
  '      </div>\n    </div>\n  );\n};\n\nexport default ActivityLogsPage;'
);

// Remove the close buttons
code = code.replace(
  /<button[^>]*onClick=\{onClose\}[^>]*>[\s\S]*?<XMarkIcon[^>]*\/>[\s\S]*?<\/button>/,
  ''
);
code = code.replace(
  /<button[^>]*onClick=\{onClose\}[^>]*>[\s\S]*?إغلاق[\s\S]*?<\/button>/,
  ''
);

fs.writeFileSync('pages/ActivityLogsPage.tsx', code);
