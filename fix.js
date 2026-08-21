const fs = require('fs');
let content = fs.readFileSync('hooks/useSupabaseData.ts', 'utf8');

// Fix 1: The original useState is broken
content = content.replace(/const \[\w+data, set_\w+data\] = React.useState<AppData>\(get_initial_data\);/, 'const [data, set_data] = React.useState<AppData>(get_initial_data);');

// Fix 2: whatsapp_share_data
content = content.replace(/const \[whatsapp_share_data, set_whatsapp_share_data\] = React.useState<\{/, 'const [whatsapp_share_data, set_whatsapp_share_data] = React.useState<{');

// Fix 3: filtered_data returning full_data
content = content.replace(/return full_data;/g, 'return data;');
content = content.replace(/return \{/, 'return {');
content = content.replace(/full_data\./g, 'data.');

// Fix 4: set_full_data declaration
content = content.replace(/const set_\w+data = React\.useCallback\(\s*\(\s*new_data:\s*Partial<AppData>\s*\|\s*\(\(prev:\s*AppData\)\s*=>\s*Partial<AppData>\)\s*\)\s*=>\s*\{/g, 'const set_full_data = React.useCallback(\n    (new_data: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => {');

// Fix 5: set_full_data usage
content = content.replace(/set_full_data:\s*set_data,/g, 'set_full_data: set_full_data,');

// Fix 6: unfiltered_data
content = content.replace(/unfiltered_data:\s*data,/g, 'unfiltered_data: data,');
content = content.replace(/unfiltered_data:\s*full_data,/g, 'unfiltered_data: data,');

// Fix 7: local_data: data
content = content.replace(/local_data: data,: data,/g, 'local_data: data,');
content = content.replace(/local_data: data,/g, 'local_data: data,');

// Fix 8: fix syntax error on line 1018
content = content.replace(/is_data_loading, data, data, user\?\.id/g, 'is_data_loading, data, user?.id');
content = content.replace(/is_data_loading, full_data, user\?\.id/g, 'is_data_loading, data, user?.id');

content = content.replace(/DATA_STORE_NAME, data, storage_key/g, 'DATA_STORE_NAME, data, storage_key');

// Let's just fix all syntax errors
// Revert ...data syntax errors if any
content = content.replace(/\.\.\.data,/g, '...data,');

fs.writeFileSync('hooks/useSupabaseData.ts', content);
