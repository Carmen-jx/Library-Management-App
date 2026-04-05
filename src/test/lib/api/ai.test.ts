import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenLibraryWork } from '@/types';

const openAiMocks = vi.hoisted(() => {
  const create = vi.fn();
  const OpenAI = vi.fn(() => ({
    chat: {
      completions: {
        create,
      },
    },
  }));

  return { create, OpenAI };
});

vi.mock('openai', () => ({
  default: openAiMocks.OpenAI,
}));

describe('AI search helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    openAiMocks.create.mockReset();
    openAiMocks.OpenAI.mockClear();
  });

  it('infers multiple genres from natural language queries', async () => {
    const ai = await import('@/lib/api/ai');

    expect(ai.inferGenresFromQuery('dark fantasy romance manga')).toEqual([
      'Fantasy',
      'Romance',
      'Graphic Novel',
    ]);
  });

  it('drops vague Fiction-only structured genres unless fiction was explicitly requested', async () => {
    const ai = await import('@/lib/api/ai');

    expect(ai.getStructuredGenres({ genres: ['literature'] })).toEqual([]);
    expect(ai.getStructuredGenres({ genres: ['fiction'] })).toEqual(['Fiction']);
  });

  it('ranks local search results by relevance and assigns explanatory reasons', async () => {
    const ai = await import('@/lib/api/ai');
    const books: OpenLibraryWork[] = [
      {
        key: '/works/OL1W',
        title: 'Fourth Wing',
        author_name: ['Rebecca Yarros'],
        subject: ['Fantasy', 'Romance', 'Dragons'],
        ratings_count: 50000,
      },
      {
        key: '/works/OL2W',
        title: 'Clean Code',
        author_name: ['Robert C. Martin'],
        subject: ['Technology', 'Programming'],
        ratings_count: 3000,
      },
    ];

    const ranked = ai.rankSearchResultsLocally(
      'dragon fantasy romance academy',
      books,
      {
        searchQuery: 'dragon fantasy romance academy',
        genres: ['fantasy', 'romance'],
        keywords: ['dragon', 'academy'],
      }
    );

    expect(ranked[0]?.book.title).toBe('Fourth Wing');
    expect(ranked[0]?.reason).toMatch(/match/i);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it('skips the AI client for simple queries and falls back to inferred metadata', async () => {
    const ai = await import('@/lib/api/ai');

    const result = await ai.naturalLanguageBookSearch('dark fantasy romance');

    expect(openAiMocks.OpenAI).not.toHaveBeenCalled();
    expect(result.searchQuery).toBe('dark fantasy romance');
    expect(result.genres).toEqual(['Fantasy', 'Romance']);
    expect(result.genre).toBe('Fantasy');
    expect(result.keywords).toEqual(['dark', 'fantasy', 'romance']);
  });

  it('parses complex-query AI output and caches repeated requests', async () => {
    openAiMocks.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              searchQuery: 'dark fantasy magic boarding school',
              title: 'Harry Potter',
              genres: ['Fantasy'],
              keywords: ['dark', 'magic', 'boarding school'],
              concepts: ['coming of age'],
            }),
          },
        },
      ],
    });

    const ai = await import('@/lib/api/ai');
    const query = 'something like Harry Potter but darker';

    const first = await ai.naturalLanguageBookSearch(query);
    const second = await ai.naturalLanguageBookSearch(query);

    expect(openAiMocks.create).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.title).toBe('Harry Potter');
    expect(first.genres).toEqual(['Fantasy']);
    expect(first.concepts).toEqual(['coming of age']);
  });

  it('falls back to tokenized query data when the AI response is invalid', async () => {
    openAiMocks.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'not valid json',
          },
        },
      ],
    });

    const ai = await import('@/lib/api/ai');
    const result = await ai.naturalLanguageBookSearch(
      'looking for a science fiction book with AI politics'
    );

    expect(result.searchQuery).toBe(
      'looking for a science fiction book with AI politics'
    );
    expect(result.genres).toEqual(
      expect.arrayContaining(['Science Fiction'])
    );
    expect(result.keywords).toEqual([
      'looking',
      'science',
      'fiction',
      'ai',
      'politics',
    ]);
  });
});