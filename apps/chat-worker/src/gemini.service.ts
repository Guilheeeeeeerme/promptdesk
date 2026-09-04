import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildPlaceholderPromptBlock,
  type PlaceholderValues,
} from './placeholders';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly defaultModel: string;
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.defaultModel = this.config.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash-lite',
    );
    this.client = new GoogleGenerativeAI(apiKey);
  }

  getModelName(override?: string): string {
    return override?.trim() || this.defaultModel;
  }

  async generateReply(params: {
    guidelines: string | null;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    placeholders: PlaceholderValues;
    model?: string;
  }): Promise<string> {
    const modelName = this.getModelName(params.model);
    const model = this.client.getGenerativeModel({ model: modelName });

    const systemParts = [
      'You are an AI support assistant. Draft a helpful reply the agent can send to the customer.',
      'Follow company guidelines strictly when provided.',
      'Be concise, professional, and actionable.',
      'Never leave square-bracket placeholders in the reply; use the known context values.',
      buildPlaceholderPromptBlock(params.placeholders),
    ];
    if (params.guidelines?.trim()) {
      systemParts.push(`Company guidelines:\n${params.guidelines.trim()}`);
    }

    const historyText = params.history
      .filter((m) => m.content.trim().length > 0)
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = [
      systemParts.join('\n\n'),
      historyText ? `Recent conversation:\n${historyText}` : null,
      `Customer message:\n${params.userMessage}`,
      'Write only the suggested reply text.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (!text) {
      this.logger.warn(`Gemini ${modelName} returned empty text`);
      throw new Error(`Gemini ${modelName} returned an empty response`);
    }
    return text;
  }
}
