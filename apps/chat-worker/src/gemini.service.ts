import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
import { neutralizeUntrusted } from './untrusted';

const PROVIDER_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1_000;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly defaultModel: string;
  private readonly client: GoogleGenerativeAI;
  private readonly requestOptions?: { baseUrl: string };

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.defaultModel = this.config.get<string>(
      "GEMINI_MODEL",
      "gemini-2.5-flash-lite",
    );
    this.client = new GoogleGenerativeAI(apiKey);
    const baseUrl = this.config.get<string>("GEMINI_BASE_URL")?.trim();
    this.requestOptions = baseUrl
      ? { baseUrl: baseUrl.replace(/\/$/, "") }
      : undefined;
  }

  getModelName(override?: string): string {
    return override?.trim() || this.defaultModel;
  }

  async validateGuideline(content: string, model?: string): Promise<unknown> {
    const modelName = this.getModelName(model);
    // Keep system policy in systemInstruction and untrusted guideline text in
    // user content — same role separation as OpenAiService.validateGuideline.
    const modelClient = this.client.getGenerativeModel(
      {
        model: modelName,
        generationConfig: {
          maxOutputTokens: 100,
          responseMimeType: "application/json",
        },
        systemInstruction: renderPrompt('support.guideline.validation.system'),
      },
      this.requestOptions,
    );    const result = await modelClient.generateContent(
      renderPrompt('support.guideline.validation.user', {
        guideline: neutralizeUntrusted(content),
      }),
      { timeout: PROVIDER_TIMEOUT_MS },
    );
    return JSON.parse(result.response.text());
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
    const model = this.client.getGenerativeModel(
      {
        model: modelName,
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        systemInstruction: prompt.systemInstruction,
      },
      this.requestOptions,
    );
    const result = await model.generateContent(prompt.context, {
      timeout: PROVIDER_TIMEOUT_MS,
    });
    const text = result.response.text()?.trim();
    if (!text) {
      this.logger.warn(`Gemini ${modelName} returned empty text`);
      throw new Error(`Gemini ${modelName} returned an empty response`);
    }
    return text;
  }
}
