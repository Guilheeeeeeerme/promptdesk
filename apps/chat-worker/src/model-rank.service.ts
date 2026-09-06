import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  DEFAULT_GEMINI_RANK,
  DEFAULT_OPENAI_RANK,
  MODEL_RANK_GEMINI_KEY,
  MODEL_RANK_OPENAI_KEY,
  MODEL_RANK_TOP_N,
  MODEL_RANK_UPDATED_AT_KEY,
  PRICING_PAGES,
  SEED_GEMINI_INPUT_USD,
  SEED_OPENAI_INPUT_USD,
  WEB_SEARCH_QUERIES,
} from './model-rank.constants';

type RankedModel = { id: string; inputUsd: number };

@Injectable()
export class ModelRankService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModelRankService.name);
  private readonly redis: Redis;
  private readonly refreshMs: number;
  private readonly topN: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.refreshMs = Number(
      this.config.get('MODEL_RANK_REFRESH_MS', 43_200_000),
    );
    this.topN = Number(
      this.config.get('MODEL_RANK_TOP_N', MODEL_RANK_TOP_N),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.refresh().catch((err) => {
      this.logger.warn(
        `Initial model rank refresh failed: ${err instanceof Error ? err.message : err}`,
      );
    });
    if (this.refreshMs > 0) {
      this.timer = setInterval(() => {
        void this.refresh().catch((err) => {
          this.logger.warn(
            `Model rank refresh failed: ${err instanceof Error ? err.message : err}`,
          );
        });
      }, this.refreshMs);
      this.timer.unref?.();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.redis.quit().catch(() => undefined);
  }

  async getGeminiRank(): Promise<string[]> {
    return this.readRank(MODEL_RANK_GEMINI_KEY, [...DEFAULT_GEMINI_RANK]);
  }

  async getOpenAiRank(): Promise<string[]> {
    return this.readRank(MODEL_RANK_OPENAI_KEY, [...DEFAULT_OPENAI_RANK]);
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const openaiKeyPresent = Boolean(
        this.config.get<string>('OPENAI_API_KEY')?.trim(),
      );
      const [geminiListed, openaiListed, pageText, searchText] =
        await Promise.all([
          this.listGeminiModels(),
          openaiKeyPresent ? this.listOpenAiModels() : Promise.resolve([]),
          this.fetchPricingPages(),
          this.webSearchPricingHints(),
        ]);

      if (!openaiKeyPresent) {
        this.logger.log(
          'OPENAI_API_KEY unset — ranking Gemini only; OpenAI list stays defaults until key present',
        );
      }

      const corpus = `${pageText}\n${searchText}`;
      const geminiParsed = this.parseGeminiPrices(corpus);
      const openaiParsed = this.parseOpenAiPrices(corpus);

      const gemini = this.pickCheapest(
        this.mergeCandidates(
          geminiListed,
          Object.keys(SEED_GEMINI_INPUT_USD),
          Object.keys(geminiParsed),
          [...DEFAULT_GEMINI_RANK],
        ),
        { ...SEED_GEMINI_INPUT_USD, ...geminiParsed },
        (id) =>
          /^gemini-\d/.test(id) &&
          !/embed|image|tts|aqa|computer/i.test(id),
        [...DEFAULT_GEMINI_RANK],
      );

      const openai = this.pickCheapest(
        this.mergeCandidates(
          openaiListed,
          Object.keys(SEED_OPENAI_INPUT_USD),
          Object.keys(openaiParsed),
          [...DEFAULT_OPENAI_RANK],
        ),
        { ...SEED_OPENAI_INPUT_USD, ...openaiParsed },
        (id) =>
          /^gpt-/i.test(id) &&
          !/instruct|realtime|audio|search|transcribe|tts|image|moderation/i.test(
            id,
          ),
        [...DEFAULT_OPENAI_RANK],
      );

      const pipeline = this.redis.multi();
      pipeline.set(MODEL_RANK_GEMINI_KEY, JSON.stringify(gemini));
      pipeline.set(MODEL_RANK_OPENAI_KEY, JSON.stringify(openai));
      pipeline.set(MODEL_RANK_UPDATED_AT_KEY, new Date().toISOString());
      await pipeline.exec();

      this.logger.log(
        `Model rank refreshed gemini=[${gemini.join(',')}] openai=[${openai.join(',')}]`,
      );
    } finally {
      this.refreshing = false;
    }
  }

  private async readRank(
    key: string,
    fallback: string[],
  ): Promise<string[]> {
    try {
      const raw = await this.redis.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((x) => typeof x === 'string') &&
          parsed.length > 0
        ) {
          return parsed.slice(0, this.topN);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed reading ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return fallback.slice(0, this.topN);
  }

  private mergeCandidates(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const group of groups) {
      for (const id of group) {
        const normalized = id.trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
      }
    }
    return out;
  }

  private pickCheapest(
    candidates: string[],
    prices: Record<string, number>,
    allow: (id: string) => boolean,
    defaults: string[],
  ): string[] {
    const ranked: RankedModel[] = [];
    for (const id of candidates) {
      if (!allow(id)) continue;
      const inputUsd = prices[id];
      if (inputUsd == null || !Number.isFinite(inputUsd)) continue;
      ranked.push({ id, inputUsd });
    }
    ranked.sort((a, b) => a.inputUsd - b.inputUsd || a.id.localeCompare(b.id));

    const picked = ranked.slice(0, this.topN).map((r) => r.id);
    if (picked.length >= this.topN) return picked;

    for (const id of defaults) {
      if (picked.includes(id)) continue;
      picked.push(id);
      if (picked.length >= this.topN) break;
    }
    return picked.slice(0, this.topN);
  }

  private async listGeminiModels(): Promise<string[]> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) return [];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`Gemini models.list HTTP ${res.status}`);
        return [];
      }
      const body = (await res.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      };
      return (body.models ?? [])
        .filter((m) =>
          (m.supportedGenerationMethods ?? []).includes('generateContent'),
        )
        .map((m) => (m.name ?? '').replace(/^models\//, ''))
        // The Gemini API also exposes non-generative service identifiers;
        // only model IDs can be passed to generateContent.
        .filter((id) => /^gemini-\d/.test(id))
        .filter(Boolean);
    } catch (err) {
      this.logger.warn(
        `Gemini models.list failed: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private async listOpenAiModels(): Promise<string[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return [];
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`OpenAI models.list HTTP ${res.status}`);
        return [];
      }
      const body = (await res.json()) as {
        data?: Array<{ id?: string }>;
      };
      return (body.data ?? [])
        .map((m) => m.id ?? '')
        .filter(Boolean);
    } catch (err) {
      this.logger.warn(
        `OpenAI models.list failed: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private async fetchPricingPages(): Promise<string> {
    const chunks: string[] = [];
    await Promise.all(
      PRICING_PAGES.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'chat-worker-model-rank/1.0',
              Accept: 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(15_000),
            redirect: 'follow',
          });
          if (!res.ok) {
            this.logger.warn(`Pricing page ${url} HTTP ${res.status}`);
            return;
          }
          const text = await res.text();
          chunks.push(text.slice(0, 400_000));
        } catch (err) {
          this.logger.warn(
            `Pricing page ${url} failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );
    return chunks.join('\n');
  }

  /** Lightweight DuckDuckGo HTML scrape as a web-search stand-in (no API key). */
  private async webSearchPricingHints(): Promise<string> {
    const chunks: string[] = [];
    for (const query of WEB_SEARCH_QUERIES) {
      try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'chat-worker-model-rank/1.0',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          this.logger.warn(`Web search HTTP ${res.status} for "${query}"`);
          continue;
        }
        chunks.push((await res.text()).slice(0, 120_000));
      } catch (err) {
        this.logger.warn(
          `Web search failed for "${query}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return chunks.join('\n');
  }

  private parseGeminiPrices(corpus: string): Record<string, number> {
    const out: Record<string, number> = {};
    const modelRe =
      /(?:`|models\/|_)?(gemini-[\w.-]+(?:-lite|-preview)?)(?:`|_|\b)/gi;
    const ids = new Set<string>();
    for (const m of corpus.matchAll(modelRe)) {
      ids.add(m[1].toLowerCase());
    }

    for (const id of ids) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const near = new RegExp(
        `${escaped}[\\s\\S]{0,400}?\\$\\s*([0-9]+(?:\\.[0-9]+)?)`,
        'i',
      );
      const hit = corpus.match(near);
      if (hit?.[1]) {
        const n = Number(hit[1]);
        if (Number.isFinite(n) && n > 0 && n < 50) out[id] = n;
      }
    }
    return out;
  }

  private parseOpenAiPrices(corpus: string): Record<string, number> {
    const out: Record<string, number> = {};
    const modelRe = /\b(gpt-[\w.-]+)\b/gi;
    const ids = new Set<string>();
    for (const m of corpus.matchAll(modelRe)) {
      ids.add(m[1].toLowerCase());
    }

    for (const id of ids) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const near = new RegExp(
        `${escaped}[\\s\\S]{0,400}?\\$\\s*([0-9]+(?:\\.[0-9]+)?)`,
        'i',
      );
      const hit = corpus.match(near);
      if (hit?.[1]) {
        const n = Number(hit[1]);
        if (Number.isFinite(n) && n > 0 && n < 50) out[id] = n;
      }
    }
    return out;
  }
}
