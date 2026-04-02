/**
 * Book Import Script
 *
 * Imports ~5000 books from Open Library into the Supabase `books` table.
 *
 * Usage:
 *   npx tsx --env-file .env scripts/importBooks.ts
 *
 * Reads from .env automatically (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).
 *
 * Optional:
 *   BOOK_COUNT         — Target number of books (default: 5000)
 *   BATCH_SIZE         — Upsert batch size (default: 50)
 *   RATE_LIMIT_MS      — Delay between Open Library requests (default: 1100)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildBookEmbeddingText, generateEmbeddingsBatch } from '../src/lib/embeddings';
import { normalizeGenres } from '../src/lib/utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_COUNT = parseInt(process.env.BOOK_COUNT ?? '5000', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '50', 10);
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS ?? '1100', 10);
const MAX_RETRIES = 3;
const OL_PAGE_LIMIT = 100; // Open Library max per page

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OLSearchDoc {
  key: string; // e.g. "/works/OL123W"
  title?: string;
  author_name?: string[];
  subject?: string[];
  first_sentence?: string[];
  cover_edition_key?: string;
  cover_i?: number;
  edition_count?: number;
  first_publish_year?: number;
  language?: string[];
  publisher?: string[];
  isbn?: string[];
  number_of_pages_median?: number;
}

interface OLSearchResponse {
  numFound: number;
  start: number;
  docs: OLSearchDoc[];
}

interface BookRecord {
  open_library_key: string;
  title: string;
  author: string;
  genre: string[];
  description: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  available: boolean;
  embedding?: string;
}

interface ImportStats {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Genre Configuration
// ---------------------------------------------------------------------------

// Subjects to query from Open Library (spread across genres for diversity)
const QUERY_SUBJECTS = [
  'fiction',
  'science_fiction',
  'fantasy',
  'mystery',
  'thriller',
  'romance',
  'horror',
  'biography',
  'history',
  'science',
  'technology',
  'self_help',
  'poetry',
  'drama',
  'humor',
  'adventure',
  'children',
  'young_adult',
  'graphic_novels',
  'literary_fiction',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Picks normalized genres from Open Library subjects. */
function mapGenres(
  subjects: string[] | undefined,
  fallbackSubject: string
): string[] {
  return normalizeGenres(subjects, { fallback: fallbackSubject, maxGenres: 6 });
}

/** Build a cover URL from Open Library data. */
function getCoverUrl(doc: OLSearchDoc): string | null {
  if (doc.cover_i) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  }
  if (doc.cover_edition_key) {
    return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
  }
  return null;
}

/** Transform an Open Library doc into a BookRecord for Supabase. */
function transformBook(
  doc: OLSearchDoc,
  querySubject: string
): BookRecord | null {
  // Extract the work key (e.g. "/works/OL123W" -> "OL123W")
  const workKey = doc.key?.replace('/works/', '');
  if (!workKey || !doc.title) return null;

  const author = doc.author_name?.[0];
  if (!author) return null;

  const title = doc.title.trim();
  if (title.length === 0) return null;

  return {
    open_library_key: workKey,
    title,
    author: author.trim(),
    genre: mapGenres(doc.subject, querySubject),
    description: doc.first_sentence?.[0] ?? null,
    cover_url: getCoverUrl(doc),
    metadata: {
      first_publish_year: doc.first_publish_year ?? null,
      edition_count: doc.edition_count ?? null,
      languages: doc.language?.slice(0, 5) ?? [],
      publishers: doc.publisher?.slice(0, 3) ?? [],
      isbn: doc.isbn?.slice(0, 3) ?? [],
      number_of_pages: doc.number_of_pages_median ?? null,
    },
    available: true,
  };
}

// ---------------------------------------------------------------------------
// API Fetch with Retry
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const backoff = 2000 * attempt;
        console.warn(`  Rate limited (429). Waiting ${backoff}ms before retry ${attempt}/${retries}...`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const backoff = 1000 * attempt;
      console.warn(`  Fetch error (attempt ${attempt}/${retries}): ${err}. Retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }

  throw new Error('fetchWithRetry: exhausted retries');
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/** Fetch a page of books from Open Library for a given subject. */
async function fetchBooks(
  subject: string,
  offset: number
): Promise<OLSearchDoc[]> {
  const url = `https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}&limit=${OL_PAGE_LIMIT}&offset=${offset}&fields=key,title,author_name,subject,first_sentence,cover_edition_key,cover_i,edition_count,first_publish_year,language,publisher,isbn,number_of_pages_median`;

  const response = await fetchWithRetry(url);
  const data = (await response.json()) as OLSearchResponse;
  return data.docs ?? [];
}

/** Upsert a batch of books into Supabase. Returns the number of rows affected. */
async function insertBatch(
  batch: BookRecord[]
): Promise<{ inserted: number; errors: number }> {
  let payload = batch;

  try {
    const embeddings = await generateEmbeddingsBatch(
      batch.map((book) => buildBookEmbeddingText(book))
    );

    payload = batch.map((book, index) => ({
      ...book,
      embedding: JSON.stringify(embeddings[index]),
    }));
  } catch (error) {
    console.error(
      `  Batch embedding error: ${error instanceof Error ? error.message : error}`
    );
  }

  const { data, error } = await supabase
    .from('books')
    .upsert(payload, { onConflict: 'open_library_key', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error(`  Batch upsert error: ${error.message}`);
    return { inserted: 0, errors: batch.length };
  }

  return { inserted: data?.length ?? batch.length, errors: 0 };
}

// ---------------------------------------------------------------------------
// Main Import Logic
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('  Open Library → Supabase Book Import');
  console.log('='.repeat(60));
  console.log(`  Target:         ${TARGET_COUNT} books`);
  console.log(`  Batch size:     ${BATCH_SIZE}`);
  console.log(`  Rate limit:     ${RATE_LIMIT_MS}ms between requests`);
  console.log(`  Subjects:       ${QUERY_SUBJECTS.length}`);
  console.log('='.repeat(60));
  console.log();

  const seenKeys = new Set<string>();
  const allBooks: BookRecord[] = [];
  const stats: ImportStats = { fetched: 0, inserted: 0, skipped: 0, errors: 0 };
  const startTime = Date.now();

  // Compute how many books to fetch per subject (roughly even distribution)
  const booksPerSubject = Math.ceil(TARGET_COUNT / QUERY_SUBJECTS.length);

  for (const subject of QUERY_SUBJECTS) {
    if (allBooks.length >= TARGET_COUNT) break;

    console.log(`\n[${subject}] Fetching books (target: ${booksPerSubject} per subject)...`);

    let offset = 0;
    let subjectCount = 0;
    let emptyPages = 0;

    while (subjectCount < booksPerSubject && allBooks.length < TARGET_COUNT) {
      try {
        const docs = await fetchBooks(subject, offset);

        if (docs.length === 0) {
          emptyPages++;
          if (emptyPages >= 2) {
            console.log(`  [${subject}] No more results. Moving to next subject.`);
            break;
          }
          offset += OL_PAGE_LIMIT;
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        emptyPages = 0;
        let pageAdded = 0;

        for (const doc of docs) {
          const book = transformBook(doc, subject);
          if (!book) {
            stats.skipped++;
            continue;
          }

          if (seenKeys.has(book.open_library_key)) {
            stats.skipped++;
            continue;
          }

          seenKeys.add(book.open_library_key);
          allBooks.push(book);
          subjectCount++;
          pageAdded++;

          if (allBooks.length >= TARGET_COUNT) break;
        }

        stats.fetched += docs.length;
        console.log(
          `  [${subject}] offset=${offset} → ${docs.length} docs, ${pageAdded} new (total: ${allBooks.length}/${TARGET_COUNT})`
        );

        offset += OL_PAGE_LIMIT;
        await sleep(RATE_LIMIT_MS);
      } catch (err) {
        console.error(`  [${subject}] Fetch error at offset ${offset}: ${err}`);
        stats.errors++;
        offset += OL_PAGE_LIMIT;
        await sleep(RATE_LIMIT_MS * 2);
      }
    }
  }

  console.log(`\nFetching complete. ${allBooks.length} unique books collected.`);
  console.log('Starting database upsert...\n');

  // Batch upsert into Supabase
  const totalBatches = Math.ceil(allBooks.length / BATCH_SIZE);

  for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = allBooks.slice(i, i + BATCH_SIZE);

    try {
      const result = await insertBatch(batch);
      stats.inserted += result.inserted;
      stats.errors += result.errors;

      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        const pct = ((batchNum / totalBatches) * 100).toFixed(1);
        console.log(
          `  Batch ${batchNum}/${totalBatches} (${pct}%) — inserted: ${stats.inserted}, errors: ${stats.errors}`
        );
      }
    } catch (err) {
      console.error(`  Batch ${batchNum} failed: ${err}`);
      stats.errors += batch.length;
    }
  }

  // Genre distribution summary
  const genreCounts: Record<string, number> = {};
  for (const book of allBooks) {
    for (const genre of book.genre) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('  Import Summary');
  console.log('='.repeat(60));
  console.log(`  Time elapsed:      ${elapsed}s`);
  console.log(`  Docs fetched:      ${stats.fetched}`);
  console.log(`  Unique books:      ${allBooks.length}`);
  console.log(`  Inserted/updated:  ${stats.inserted}`);
  console.log(`  Skipped:           ${stats.skipped}`);
  console.log(`  Errors:            ${stats.errors}`);
  console.log();
  console.log('  Genre Distribution:');
  Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([genre, count]) => {
      const bar = '#'.repeat(Math.ceil(count / (TARGET_COUNT / 40)));
      console.log(`    ${genre.padEnd(16)} ${String(count).padStart(5)}  ${bar}`);
    });
  console.log('='.repeat(60));
  console.log('  Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
