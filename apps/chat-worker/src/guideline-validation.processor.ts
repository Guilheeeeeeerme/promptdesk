import { Processor, WorkerHost } from "@nestjs/bullmq";
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
import {
  executeGuidelineValidation,
  type GuidelineLifecycleStore,
} from "./guideline-validation.lifecycle";

@Processor(GUIDELINE_VALIDATE_QUEUE)
export class GuidelineValidationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: CorePrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
    private readonly events: EventsPublisher,
  ) {
    super();
  }

  async process(job: Job<GuidelineValidateJobData>): Promise<void> {
    const validator = new GuidelineValidator(
      this.openai.isConfigured() ? this.openai : this.gemini,
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
