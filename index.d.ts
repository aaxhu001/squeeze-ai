/**
 * SQUEEZE TypeScript Definitions
 */

export interface CompressionOptions {
  enableJSON?: boolean;
  enableCode?: boolean;
  enableCCR?: boolean;
  enableCacheAligner?: boolean;
  maxArrayItems?: number;
  truncateStrings?: number;
}

export interface CompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  contentType: string;
  ccrChunksCount: number;
}

export function compress(input: string | object, options?: CompressionOptions): CompressionResult;

export class SmartJSONCrusher {
  static crush(input: string | object, options?: CompressionOptions): CompressionResult;
}

export class CodeCompressor {
  static compress(code: string, language?: string, options?: CompressionOptions): CompressionResult;
}

export class CCRStore {
  put(id: string, content: string, meta?: object): string;
  get(id: string): string | null;
  has(id: string): boolean;
  hydrate(text: string): string;
  stats(): { entries: number; totalBytes: number; totalTokensApprox: number };
  clear(): void;
}

export const globalCCR: CCRStore;

export class OutputShaper {
  static steerSystemPrompt(systemPrompt?: string, options?: object): string;
  static shapeEffort(payload: object, options?: object): object;
}
