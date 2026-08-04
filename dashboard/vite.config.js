import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const reportSource = fileURLToPath(
  new URL('../docs/Waste Picker System - System Documentation.pdf', import.meta.url)
);
function publishSystemReport() {
  let config;

  return {
    name: 'publish-system-report',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      server.middlewares.use('/docs/waste-picker-system-report.pdf', (_req, res, next) => {
        const stream = createReadStream(reportSource);
        stream.on('error', next);
        res.setHeader('Content-Type', 'application/pdf');
        stream.pipe(res);
      });
    },
    async writeBundle(outputOptions) {
      if (config.command !== 'build') return;
      const configuredOutDir = outputOptions.dir || config.build.outDir;
      const outDir = isAbsolute(configuredOutDir)
        ? configuredOutDir
        : resolve(config.root, configuredOutDir);
      const reportDirectory = join(outDir, 'docs');
      const reportTarget = join(reportDirectory, 'waste-picker-system-report.pdf');
      await mkdir(reportDirectory, { recursive: true });
      await copyFile(reportSource, reportTarget);
    },
  };
}

export default defineConfig({
  plugins: [react(), publishSystemReport()],
  server: { port: 5173 },
});
