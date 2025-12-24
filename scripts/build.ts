import { build } from 'esbuild';

await build({
  entryPoints: ['api/slack.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist/api',
  external: [],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log('Build complete!');
