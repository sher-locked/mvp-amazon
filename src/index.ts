import { loadConfig } from './config';
import { buildContainer } from './container';
import { buildApp } from './server/app';

async function main(): Promise<void> {
  const config = loadConfig();
  const container = buildContainer(config);
  const app = buildApp(container);

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    container.logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
