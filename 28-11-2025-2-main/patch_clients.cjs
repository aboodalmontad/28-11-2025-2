const fs = require('fs');
let code = fs.readFileSync('pages/ClientsPage.tsx', 'utf8');

const searchRegex = /<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">[\s\S]*?<div className="bg-white p-4 rounded-lg shadow space-y-4">/;

if (searchRegex.test(code)) {
  code = code.replace(searchRegex, (match) => {
    return `<div className="sticky top-0 z-20 bg-gray-100 -mx-4 px-4 -mt-4 pt-4 pb-4 shadow-sm border-b border-gray-200 mb-6 space-y-6">\n      ` + match;
  });
  
  // Now we need to find the end of the search/sort div to close our sticky wrapper.
  // The structure ends with:
  //         </div>
  //       </div>
  //       <div>
  //         {view_mode === "tree" ? (
  
  const closingRegex = /        <\/div>\n      <\/div>\n      <div>\n        \{view_mode === "tree" \? \(/;
  code = code.replace(closingRegex, (match) => {
    return `        </div>\n      </div>\n      </div>\n      <div>\n        {view_mode === "tree" ? (`
  });
  
  fs.writeFileSync('pages/ClientsPage.tsx', code);
  console.log("Patched successfully!");
} else {
  console.log("Could not find match");
}
