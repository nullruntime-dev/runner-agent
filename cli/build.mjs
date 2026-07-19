import * as esbuild from 'esbuild';
import { createRequire } from 'module';

// Plugin to stub react-devtools-core (ink optional dep)
const stubDevtools = {
  name: 'stub-devtools',
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: 'react-devtools-core',
      namespace: 'stub-devtools',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-devtools' }, () => ({
      contents: 'export default {}; export const connectToDevTools = () => {};',
      loader: 'js',
    }));
  },
};

// Banner to support require() in ESM bundle
const banner = `
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname2 } from 'path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname2(__filename);
`.trim();

await esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'esm',
  external: ['yoga-wasm-web'],
  plugins: [stubDevtools],
  banner: { js: banner },
});

console.log('Build complete: dist/index.js');
