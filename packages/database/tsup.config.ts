import { defineConfig } from 'tsup';
import { peggyPlugin } from './src/scripts/peggy.plugin';

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
  loader: {
    '.pegjs': 'ts',
  },
  esbuildPlugins: [peggyPlugin()],
});
