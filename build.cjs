
const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const publicDir = 'public';

async function build() {
    try {
        console.log('Starting build for Vercel...');

        // 1. Clean and create public directory
        await fs.emptyDir(publicDir);

        // 2. Build and bundle TypeScript/TSX files
        await esbuild.build({
            entryPoints: ['index.tsx'],
            bundle: true,
            // Single bundle file to prevent "Failed to fetch dynamically imported module" errors
            outfile: path.join(publicDir, 'index.js'),
            splitting: false, 
            jsx: 'automatic',
            format: 'esm',
            sourcemap: true,
            minify: true,
            target: 'es2020',
            // Bundle all dependencies to ensure stability and avoid importmap conflicts
            external: [],
        });

        // 3. Copy static assets to public directory
        const staticAssets = ['index.html', 'manifest.json', 'icon.svg', 'sw.js'];
        await Promise.all(
            staticAssets.map(asset => {
                if (fs.existsSync(asset)) {
                    return fs.copy(asset, path.join(publicDir, asset));
                }
                console.warn(`Asset not found and will not be copied: ${asset}`);
                return Promise.resolve();
            })
        );
        
        console.log('Build finished successfully!');

    } catch (e) {
        console.error('Build process failed:', e);
        process.exit(1);
    }
}

build();
