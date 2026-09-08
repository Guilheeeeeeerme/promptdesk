import { Processor, WorkerHost } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { CorePrismaService } from "./core-prisma.service";
import { GeminiService } from "./gemini.service";
import { OpenAiService } from "./openai.service";
import { GuidelineValidator } from "./guideline-validator";
import {
  GUIDELINE_VALIDATE_QUEUE,
  type GuidelineValidateJobData,
} from "./chat.constants";
import { EventsPublisher } from "./events.publisher";
import { ModelRankService } from './model-rank.service';
import {
  executeGuidelineValidation,
  type GuidelineLifecycleStore,
} from "./guideline-validation.lifecycle";
import {
  createGeminiFirstGuidelineProvider,
  resolveProviderOrder,
  type GuidelineModelProvider,
} from './provider-policy';
import { LlmBudgetService } from './llm-budget';

@Processor(GUIDELINE_VALIDATE_QUEUE)
export class GuidelineValidationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: CorePrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
    private readonly modelRank: ModelRankService,
    private readonly events: EventsPublisher,
    private readonly config: ConfigService,
    private readonly llmBudget: LlmBudgetService,
  ) {
    super();
  }

  async process(job: Job<GuidelineValidateJobData>): Promise<void> {
    const companyId = job.data.companyId;
    const [geminiModels, openaiModels] = await Promise.all([
      this.modelRank.getGeminiRank(),
      this.modelRank.getOpenAiRank(),
    ]);
    const providerOrder = resolveProviderOrder(
      this.config.get<string>('LLM_PROVIDER_ORDER'),
      { gemini: true, openai: this.openai.isConfigured() },
    );

    const withBudget = (
      service: GuidelineModelProvider,
    ): GuidelineModelProvider => ({
      validateGuideline: async (content, model) => {
        // Fail closed before every provider invoke (LLM06 worker budgets).
        await this.llmBudget.assertAllowed(companyId);
        return service.validateGuideline(content, model);
      },
    });

    const validator = new GuidelineValidator(
      createGeminiFirstGuidelineProvider(
        withBudget(this.gemini),
        geminiModels,
        withBudget(this.openai),
        openaiModels,
        this.openai.isConfigured(),
        providerOrder,
      ),
    );
    await executeGuidelineValidation(
      this.prisma as unknown as GuidelineLifecycleStore,
      job.data,
      async (input) => {
        const result = await validator.validate(input);
        if (result.status === "pending") {
          throw new Error("Guideline validator returned pending after claim");
        }
        return {
          status: result.status === "malicious" ? "invalid" : result.status,
          reason: result.reason,
        };
      },
      (event) => this.events.publish(event),
    );
  }
}
