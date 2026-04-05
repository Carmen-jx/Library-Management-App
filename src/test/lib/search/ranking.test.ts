import { describe, expect, it } from 'vitest';
import {
  buildQuerySignals,
  scoreBookCandidate,
  scoreOpenLibraryCandidate,
  tokenize,
} from '@/lib/search/ranking';
import type { Book, OpenLibraryWork } from '@/types';

describe('tokenize', () => {
  it('removes stop words, punctuation, and one-character fragments', () => {
    expect(tokenize('A book for me, with sci-fi and AI!')).toEqual([
      'sci',
      'fi',
      'ai',
    ]);
  });
});

describe('buildQuerySignals', () => {
  it('normalizes structured query fields and genres', () => {
    const signals = buildQuerySignals('Dark fantasy romance', {
      searchQuery: 'dark fantasy romance',
      title: ' Fourth Wing ',
      author: ' Rebecca Yarros ',
      genres: ['fantasy', 'romance'],
      keywords: ['dragons', 'academy'],
      concepts: ['found family'],
    });

    expect(signals.searchQuery).toBe('dark fantasy romance');
    expect(signals.title).toBe('fourth wing');
    expect(signals.author).toBe('rebecca yarros');
    expect(signals.requestedGenres).toEqual(['Fantasy', 'Romance']);
    expect(signals.keywords).toEqual(['dragons', 'academy']);
    expect(signals.concepts).toEqual(['found', 'family']);
  });
});

describe('scoreBookCandidate', () => {
  it('scores an exact title-author-genre match above a weak match', () => {
    const exactMatch: Pick<Book, 'title' | 'author' | 'genre' | 'description'> = {
      title: 'Dune',
      author: 'Frank Herbert',
      genre: ['Science Fiction'],
      description: 'A desert planet, prophecy, and political struggle.',
    };
    const weakMatch: Pick<Book, 'title' | 'author' | 'genre' | 'description'> = {
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      genre: ['Romance'],
      description: 'A classic Regency romance.',
    };

    const signals = buildQuerySignals('books like Dune by Frank Herbert', {
      searchQuery: 'Dune Frank Herbert',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['science fiction'],
      keywords: ['desert', 'politics'],
    });

    expect(scoreBookCandidate(exactMatch, signals)).toBeGreaterThan(
      scoreBookCandidate(weakMatch, signals)
    );
  });
});

describe('scoreOpenLibraryCandidate', () => {
  it('clamps negative scores to zero for obvious mismatches', () => {
    const book: OpenLibraryWork = {
      key: '/works/OL1W',
      title: 'Cooking with Herbs',
      author_name: ['Chef Example'],
      subject: ['Cooking', 'Food'],
    };

    const signals = buildQuerySignals('books by Octavia Butler', {
      searchQuery: 'Octavia Butler',
      author: 'Octavia Butler',
      genres: ['science fiction'],
    });

    expect(scoreOpenLibraryCandidate(book, signals)).toBe(0);
  });
});