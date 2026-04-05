import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPrimaryGenre, normalizeGenres, timeAgo } from '@/lib/utils';

describe('normalizeGenres', () => {
  it('returns Fiction when no valid genres are supplied', () => {
    expect(normalizeGenres(null)).toEqual(['Fiction']);
    expect(normalizeGenres(['', 'unknown label'])).toEqual(['Fiction']);
  });

  it('deduplicates aliases while preserving an explicitly requested Fiction genre', () => {
    expect(
      normalizeGenres(['fiction', 'dark fantasy', 'sci-fi', 'science fiction'])
    ).toEqual(['Fiction', 'Fantasy', 'Science Fiction']);
  });

  it('uses fallback genres when the primary value cannot be normalized', () => {
    expect(
      normalizeGenres('not-a-real-genre', { fallback: ['memoir', 'history'] })
    ).toEqual(['Biography', 'History']);
  });

  it('respects the configured max genre count', () => {
    expect(
      normalizeGenres(
        [
          'fantasy',
          'science fiction',
          'romance',
          'mystery',
          'thriller',
          'history',
        ],
        { maxGenres: 3 }
      )
    ).toEqual(['Fantasy', 'Science Fiction', 'Romance']);
  });
});

describe('getPrimaryGenre', () => {
  it('returns the first normalized genre', () => {
    expect(getPrimaryGenre(['memoir', 'history'])).toBe('Biography');
  });
});

describe('timeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats recent timestamps across cutoff boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T12:00:00Z'));

    expect(timeAgo('2026-04-05T11:59:45Z')).toBe('just now');
    expect(timeAgo('2026-04-05T11:10:00Z')).toBe('50m ago');
    expect(timeAgo('2026-04-05T09:00:00Z')).toBe('3h ago');
    expect(timeAgo('2026-04-03T12:00:00Z')).toBe('2d ago');
  });
});