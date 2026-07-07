import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('node_modules/scanbot-web-sdk/bundle/bin/barcode-scanner');
const destDir = path.resolve('public/scanbot-bin');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source directory ${src} does not exist.`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${entry.name} to public/scanbot-bin`);
    }
  }
}

try {
  copyDir(srcDir, destDir);
  console.log('Scanbot SDK bin files successfully copied to public/scanbot-bin');
} catch (err) {
  console.error('Error copying Scanbot SDK bin files:', err);
}
