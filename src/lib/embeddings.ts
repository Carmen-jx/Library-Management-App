import OpenAI from 'openai';

// --- OpenAI client (separate from DeepSeek) ---

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// --- In-memory embedding cache ---

const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 500;

// --- Generate embedding via OpenAI ---

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000); // text-embedding-3-small input limit
  if (!trimmed) throw new Error('Cannot generate embedding for empty text');

  const cached = embeddingCache.get(trimmed);
  if (cached) return cached;

  const response = await getOpenAIClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: trimmed,
  });

  const embedding = response.data[0].embedding;

  // Evict oldest entries if cache is full
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }

  embeddingCache.set(trimmed, embedding);
  return embedding;
}

// --- Build embedding text from book data ---

export function buildBookEmbeddingText(book: {
  title: string;
  author: string;
  description?: string | null;
  genre?: string[];
}): string {
  const parts = [book.title, `by ${book.author}`];

  if (book.genre && book.genre.length > 0) {
    parts.push(`Genre: ${book.genre.join(', ')}`);
  }

  if (book.description) {
    parts.push(book.description.slice(0, 500));
  }

  return parts.join('. ');
}

// --- Generate embeddings in batch (for scripts) ---

export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const trimmed = texts.map((t) => t.trim().slice(0, 8000));

  const response = await getOpenAIClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: trimmed,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
