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
import { JevService } from './jev.service';
import {
  createJevGuidelineProvider,
  statusFromJevChoice,
  buildGuidelineQuestions,
  GUIDELINE_JEV_RUBRIC,
} from './jev-guideline.provider';

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
    private readonly jev: JevService,
  ) {
    super();
  }

  async process(job: Job<GuidelineValidateJobData>): Promise<void> {
    const companyId = job.data.companyId;
    const mode = this.jev.guidelineMode;

    const llmProvider = await this.buildLlmProvider(companyId);

    const validator = new GuidelineValidator(
      mode === 'active' && this.jev.isConfigured()
        ? this.withBudget(companyId, createJevGuidelineProvider(this.jev))
        : llmProvider,
    );

    await executeGuidelineValidation(
      this.prisma as unknown as GuidelineLifecycleStore,
      job.data,
      async (input) => {
        const result = await validator.validate(input);
        if (result.status === "pending") {
          throw new Error("Guideline validator returned pending after claim");
        }

        if (mode === 'shadow' && this.jev.isConfigured() && result.status !== 'provider_error') {
          await this.shadowCompare(input.content, result.status);
        }

        return {
          status: result.status === "malicious" ? "invalid" : result.status,
          reason: result.reason,
        };
      },
      (event) => this.events.publish(event),
    );
  }

  private async buildLlmProvider(companyId: string): Promise<GuidelineModelProvider> {
    const [geminiModels, openaiModels] = await Promise.all([
      this.modelRank.getGeminiRank(),
      this.modelRank.getOpenAiRank(),
    ]);
    const providerOrder = resolveProviderOrder(
      this.config.get<string>('LLM_PROVIDER_ORDER'),
      { gemini: true, openai: this.openai.isConfigured() },
    );
    return createGeminiFirstGuidelineProvider(
      this.withBudget(companyId, this.gemini),
      geminiModels,
      this.withBudget(companyId, this.openai),
      openaiModels,
      this.openai.isConfigured(),
      providerOrder,
    );
  }

  private withBudget(
    companyId: string,
    service: GuidelineModelProvider,
  ): GuidelineModelProvider {
    return {
      validateGuideline: async (content, model) => {
        await this.llmBudget.assertAllowed(companyId);
        return service.validateGuideline(content, model);
      },
    };
  }

  private async shadowCompare(
    content: string,
    productionStatus: string,
  ): Promise<void> {
    try {
      await this.llmBudget.assertAllowed('jev-shadow');
      const decision = await this.jev.decideChoice(
        { rubric: GUIDELINE_JEV_RUBRIC, guideline: content },
        buildGuidelineQuestions(),
        'shadow',
      );
      const jevStatus = statusFromJevChoice(decision.answers.status?.choice ?? '');
      this.jev.logShadowCompare({
        task: 'guideline',
        agree: jevStatus === productionStatus,
        productionStatus,
        jevStatus,
        estimatedUsd: decision.meta.estimatedUsd,
        durationMs: decision.meta.durationMs,
        model: decision.meta.returnedModel ?? decision.meta.requestedModel,
      });
    } catch (error) {
      this.jev.logShadowError({
        task: 'guideline',
        code: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
