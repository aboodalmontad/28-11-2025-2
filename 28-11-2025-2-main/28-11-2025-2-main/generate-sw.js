import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const swPath = path.join(distDir, 'sw.js');

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      // Get relative path from dist/
      const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
      // Exclude sw.js, map files, and system files
      if (
        relPath !== 'sw.js' &&
        !relPath.endsWith('.map') &&
        !relPath.startsWith('.') &&
        !relPath.includes('node_modules')
      ) {
        fileList.push('./' + relPath);
      }
    }
  }
  return fileList;
}

try {
  if (fs.existsSync(swPath)) {
    console.log('Generating dynamic Service Worker asset cache list...');
    const files = getFiles(distDir);
    
    // Add essential fallback routes and CDNs
    const urlsToCache = [
      './',
      './index.html',
      './manifest.json',
      './icon.svg',
      'https://cdn.tailwindcss.com',
      'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
      ...files
    ];
    
    // De-duplicate and filter empty items
    const uniqueUrls = [...new Set(urlsToCache)].filter(Boolean);
    
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Replace the urlsToCache array placeholder
    const arrayRegex = /const\s+urlsToCache\s*=\s*\[[\s\S]*?\];/;
    const replacement = `const urlsToCache = ${JSON.stringify(uniqueUrls, null, 2)};`;
    
    if (arrayRegex.test(swContent)) {
      swContent = swContent.replace(arrayRegex, replacement);
      fs.writeFileSync(swPath, swContent, 'utf8');
      console.log(`Successfully injected ${uniqueUrls.length} URLs to precache in ${swPath}`);
    } else {
      console.warn('Placeholder const urlsToCache not found in sw.js');
    }
  } else {
    console.error(`Service Worker file not found at ${swPath}`);
  }
} catch (error) {
  console.error('Error in generate-sw.js:', error);
}
