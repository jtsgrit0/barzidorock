const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../build');
const manifestPath = path.join(buildDir, 'manifest.json');
const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const withPublicUrl = (value) => value.replace(/%PUBLIC_URL%/g, publicUrl);

manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: withPublicUrl(icon.src),
}));

manifest.start_url = withPublicUrl(manifest.start_url || '.');
if (publicUrl) {
  manifest.scope = `${publicUrl}/`;
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// SPA fallback for GitHub Pages
const indexPath = path.join(buildDir, 'index.html');
const notFoundPath = path.join(buildDir, '404.html');
fs.copyFileSync(indexPath, notFoundPath);
