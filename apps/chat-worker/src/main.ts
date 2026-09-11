import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './json-logger';

async function bootstrap() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY is required; chat-worker will not start without it');
  }
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule, { logger });
  const port = Number(process.env.CHAT_WORKER_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`Chat worker listening on port ${port}`, 'Bootstrap');
}

bootstrap();
