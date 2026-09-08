import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ChatGenerateProcessor } from "./chat.processor";
import {
  CHAT_GENERATE_QUEUE,
  GUIDELINE_VALIDATE_QUEUE,
} from "./chat.constants";
import { GuidelineValidationProcessor } from "./guideline-validation.processor";
import { CorePrismaService } from "./core-prisma.service";
import { EventsPublisher } from "./events.publisher";
import { GeminiService } from "./gemini.service";
import { HealthController } from "./health.controller";
import { LlmBudgetService } from "./llm-budget";
import { ModelRankService } from "./model-rank.service";
import { OpenAiService } from "./openai.service";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: CHAT_GENERATE_QUEUE,
    }),
    BullModule.registerQueue({ name: GUIDELINE_VALIDATE_QUEUE }),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    CorePrismaService,
    GeminiService,
    OpenAiService,
    ModelRankService,
    LlmBudgetService,
    EventsPublisher,
    ChatGenerateProcessor,
    GuidelineValidationProcessor,
  ],
})
export class AppModule {}
