import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  buildSupportPrompt,
  type SupportPromptMessage,
  type SupportPromptMode,
  type SupportLocale,
} from "./chat.constants";
import {
  type PlaceholderValues,
} from "./placeholders";
import { renderPrompt } from './prompt-registry';

const PROVIDER_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1_000;

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly defaultModel: string;
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    this.defaultModel = this.config.get<string>("OPENAI_MODEL", "gpt-5-nano");
  }

  getModelName(override?: string): string {
    return override?.trim() || this.defaultModel;
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("OPENAI_API_KEY")?.trim());
  }

  async validateGuideline(content: string, model?: string): Promise<unknown> {
    const completion = await this.getClient().chat.completions.create(
      {
        model: this.getModelName(model),
        messages: [
          {
            role: "system",
            content: renderPrompt('support.guideline.validation.system'),
          },
          {
            role: "user",
            content: renderPrompt('support.guideline.validation.user', {
              guideline: content,
            }),
          },
        ],
        max_completion_tokens: 100,
        response_format: { type: "json_object" },
      },
      { timeout: PROVIDER_TIMEOUT_MS },
    );
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  }

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI failover");
    }
    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async generateReply(params: {
    guidelines: string | null;
    history: SupportPromptMessage[];
    userMessage: string;
    placeholders: PlaceholderValues;
    mode?: SupportPromptMode;
    model?: string;
    locale?: SupportLocale;
  }): Promise<string> {
    const modelName = this.getModelName(params.model);
    const prompt = buildSupportPrompt({
      guidelines: params.guidelines,
      history: params.history,
      agentRequest: params.userMessage,
      knownContext: params.placeholders,
      mode: params.mode,
      locale: params.locale,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: prompt.systemInstruction },
      { role: "user", content: prompt.context },
    ];

    const completion = await this.getClient().chat.completions.create(
      {
        model: modelName,
        messages,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      },
      { timeout: PROVIDER_TIMEOUT_MS },
    );

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      this.logger.warn(`OpenAI ${modelName} returned empty text`);
      throw new Error(`OpenAI ${modelName} returned an empty response`);
    }
    return text;
  }
}
