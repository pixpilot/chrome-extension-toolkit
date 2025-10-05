import type { ManifestV3Export } from '@crxjs/vite-plugin';

import packageData from '../package.json';

interface PackageJson {
  displayName?: string;
  name: string;
  description: string;
  version: string;
}

export function getManifest(isDev: boolean): ManifestV3Export {
  const pkg = packageData as PackageJson;
  const manifest: ManifestV3Export = {
    name: `${pkg.displayName ?? pkg.name}${isDev ? ` ➡️ Dev` : ''}`,
    description: pkg.description,
    version: pkg.version,
    manifest_version: 3,
    icons: {
      16: 'img/logo-16.png',
      32: 'img/logo-32.png',
      48: 'img/logo-48.png',
      128: 'img/logo-128.png',
    },
    action: {
      default_popup: 'popup.html',
      default_icon: 'img/logo-48.png',
    },
    options_page: 'options.html',
    devtools_page: 'devtools.html',
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['src/contentScript/index.ts'],
      },
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: [
          'img/logo-16.png',
          'img/logo-32.png',
          'img/logo-48.png',
          'img/logo-128.png',
        ],
        matches: [],
      },
    ],
    permissions: ['sidePanel', 'storage'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
  };

  return manifest;
}
