/**
 * Generate Embeddings Script
 *
 * Generates OpenAI embeddings for all books in the Supabase `books` table.
 *
 * Usage:
 *   npx tsx --env-file .env scripts/generateEmbeddings.ts
 *
 * Reads from .env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY).
 *
 * Optional:
 *   BATCH_SIZE — Number of books per batch (default: 50)
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '50', 10);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BookRow {
  id: string;
  title: string;
  author: string;
  description: string | null;
  genre: string[];
}

function buildEmbeddingText(book: BookRow): string {
  const parts = [book.title, `by ${book.author}`];
  if (book.genre && book.genre.length > 0) {
    parts.push(`Genre: ${book.genre.join(', ')}`);
  }
  if (book.description) {
    parts.push(book.description.slice(0, 500));
  }
  return parts.join('. ');
}

async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map((t) => t.slice(0, 8000)),
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching books without embeddings...');

  // Fetch all books that don't have embeddings yet
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, author, description, genre')
    .is('embedding', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch books:', error.message);
    process.exit(1);
  }

  if (!books || books.length === 0) {
    console.log('All books already have embeddings.');
    return;
  }

  console.log(`Found ${books.length} books to process.`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE) as BookRow[];
    const texts = batch.map(buildEmbeddingText);

    try {
      const embeddings = await generateEmbeddingsBatch(texts);

      // Update each book with its embedding
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from('books')
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq('id', batch[j].id);

        if (updateError) {
          console.error(
            `  Failed to update book "${batch[j].title}": ${updateError.message}`
          );
          failed++;
        } else {
          processed++;
        }
      }

      console.log(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${processed}/${books.length} processed, ${failed} failed`
      );

      // Rate limit — avoid hitting OpenAI rate limits
      if (i + BATCH_SIZE < books.length) {
        await sleep(200);
      }
    } catch (err) {
      console.error(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        err instanceof Error ? err.message : err
      );
      failed += batch.length;
    }
  }

  console.log(`\nDone. Processed: ${processed}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
