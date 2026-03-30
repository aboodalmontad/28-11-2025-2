const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

async function build() {
    try {
        console.log('Starting build...');

        // Build and bundle TypeScript/TSX files
        await esbuild.build({
            entryPoints: ['index.tsx'],
            bundle: true,
            // Disable splitting to avoid "Failed to fetch" on dynamic chunks in restricted origins
            splitting: false,
            // Output directly to root so index.html finds it at ./index.js
            outfile: 'index.js',
            jsx: 'automatic',
            format: 'esm',
            sourcemap: true,
            minify: true,
            target: 'es2020',
            // All packages from importmap are external
            external: [
                'react',
                'react-dom',
                'react-dom/client',
                '@supabase/supabase-js',
                'recharts',
                'idb',
                'react-router-dom',
                'react/*',
                'docx-preview',
            ],
        });
        
        console.log('Build finished successfully!');

    } catch (e) {
        console.error('Build process failed:', e);
        process.exit(1);
    }
}

build();