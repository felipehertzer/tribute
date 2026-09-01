import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

import packageMetadata from './package.json' with { type: 'json' };

const projectRoot = import.meta.dirname;

function syncReleaseArtifacts(minified: boolean): Plugin {
  return {
    name: 'tribute:sync-release-artifacts',
    closeBundle() {
      const stylesheet = resolve(projectRoot, 'src/tribute.css');
      const exampleDirectory = resolve(projectRoot, 'example');
      const outputDirectory = resolve(projectRoot, 'dist');

      mkdirSync(exampleDirectory, { recursive: true });
      mkdirSync(outputDirectory, { recursive: true });
      copyFileSync(stylesheet, resolve(outputDirectory, 'tribute.css'));
      copyFileSync(stylesheet, resolve(exampleDirectory, 'tribute.css'));

      if (minified) {
        copyFileSync(resolve(outputDirectory, 'tribute.min.mjs'), resolve(exampleDirectory, 'tribute.min.mjs'));
        copyFileSync(resolve(outputDirectory, 'tribute.min.mjs.map'), resolve(exampleDirectory, 'tribute.min.mjs.map'));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const minified = mode === 'minified';
  const suffix = minified ? '.min' : '';

  return {
    plugins: [syncReleaseArtifacts(minified)],
    build: {
      copyPublicDir: false,
      emptyOutDir: !minified,
      lib: {
        entry: resolve(projectRoot, 'src/index.ts'),
        fileName: (format) => (format === 'es' ? `tribute${suffix}.mjs` : `tribute${suffix}.js`),
        formats: ['es', 'umd'],
        name: 'Tribute',
      },
      minify: minified ? 'oxc' : false,
      rolldownOptions: {
        output: {
          banner: minified ? `/* Tribute.js v${packageMetadata.version} license MIT */` : undefined,
        },
      },
      sourcemap: minified,
      target: 'es2016',
    },
  };
});
