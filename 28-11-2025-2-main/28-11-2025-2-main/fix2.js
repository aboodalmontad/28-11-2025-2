const fs = require('fs');
let content = fs.readFileSync('hooks/useSupabaseData.ts', 'utf8');
content = content.replace(/load_local_data: data,/g, 'load_local_data');
content = content.replace(/has_local_data: data,/g, 'has_local_data');
content = content.replace(/fetch_remote_data: data,/g, 'fetch_remote_data');
content = content.replace(/set_whatsapp_share_data: data,/g, 'set_whatsapp_share_data');
fs.writeFileSync('hooks/useSupabaseData.ts', content);
