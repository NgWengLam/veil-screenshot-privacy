import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
// Only this project's generated output is replaced. No bundler or remote assets.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
await cp(path.join(root, 'manifest.json'), path.join(out, 'manifest.json'));
const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
console.log(`Built Veil ${manifest.version} → dist/ (load this folder as an unpacked extension)`);

// Firefox build: same code, Firefox-specific manifest.
// Firefox MV3 has no background service worker; it runs the same module as a background script.
const firefoxOut = path.join(root, 'dist-firefox');
await rm(firefoxOut, { recursive: true, force: true });
await cp(out, firefoxOut, { recursive: true });
const firefox = structuredClone(manifest);
delete firefox.minimum_chrome_version;
firefox.background = { scripts: [manifest.background.service_worker], type: 'module' };
firefox.browser_specific_settings = {
  gecko: {
    id: 'veil-screenshot-privacy@veil',
    strict_min_version: '128.0',
    data_collection_permissions: { required: ['none'] },
  },
};
await writeFile(path.join(firefoxOut, 'manifest.json'), `${JSON.stringify(firefox, null, 2)}\n`);
console.log(`Built Veil ${manifest.version} for Firefox → dist-firefox/ (load manifest.json via about:debugging)`);
