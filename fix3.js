const fs = require('fs');
let content = fs.readFileSync('hooks/useSupabaseData.ts', 'utf8');

// Fix 1022
content = content.replace(/const set_data = React\.useCallback\(\n    \(new_data: Partial<AppData> \| \(\(prev: AppData\) => Partial<AppData>\)\) => \{/g, 'const set_full_data = React.useCallback(\n    (new_data: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => {');

// Fix 680
content = content.replace(/local_data,/g, 'local_data: data,');
// But be careful to undo if it messes up other places, wait!
// Actually, let's just replace line 680 directly.
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const set_data = React.useCallback(')) {
        lines[i] = lines[i].replace('const set_data', 'const set_full_data');
    }
    if (lines[i].includes('local_data,') && i > 670 && i < 690) {
        lines[i] = lines[i].replace('local_data,', 'local_data: data,');
    }
    if (lines[i].includes('JSON.stringify(full_data,')) {
        lines[i] = lines[i].replace('full_data', 'data');
    }
    if (lines[i].includes('DATA_STORE_NAME, full_data,')) {
        lines[i] = lines[i].replace('full_data', 'data');
    }
}
fs.writeFileSync('hooks/useSupabaseData.ts', lines.join('\n'));
