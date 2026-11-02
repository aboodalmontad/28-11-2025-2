const fs = require('fs');
let code = fs.readFileSync('pages/ClientsPage.tsx', 'utf8');

const regex = /        <\/div>\n      <\/div>\n\n      <div>\n        \{view_mode === "tree" \? \(/;

if (regex.test(code)) {
    code = code.replace(regex, '        </div>\n      </div>\n      </div>\n\n      <div>\n        {view_mode === "tree" ? (');
    fs.writeFileSync('pages/ClientsPage.tsx', code);
    console.log("Fixed!");
} else {
    console.log("No match found for fix.js");
}
