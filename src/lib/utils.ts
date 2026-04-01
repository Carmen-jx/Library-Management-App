export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const GENRES = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Romance',
  'Horror',
  'Biography',
  'History',
  'Science',
  'Technology',
  'Self-Help',
  'Poetry',
  'Drama',
  'Comedy',
  'Adventure',
  'Children',
  'Young Adult',
  'Graphic Novel',
] as const;

const GENRE_ALIASES: Record<string, (typeof GENRES)[number]> = {
  fiction: 'Fiction',
  literary_fiction: 'Fiction',
  'literary fiction': 'Fiction',
  literature: 'Fiction',
  novels: 'Fiction',
  'non-fiction': 'Non-Fiction',
  nonfiction: 'Non-Fiction',
  business: 'Non-Fiction',
  economics: 'Non-Fiction',
  politics: 'Non-Fiction',
  education: 'Non-Fiction',
  philosophy: 'Non-Fiction',
  religion: 'Non-Fiction',
  spirituality: 'Non-Fiction',
  science_fiction: 'Science Fiction',
  'science fiction': 'Science Fiction',
  sci_fi: 'Science Fiction',
  'sci-fi': 'Science Fiction',
  scifi: 'Science Fiction',
  dystopia: 'Science Fiction',
  cyberpunk: 'Science Fiction',
  fantasy: 'Fantasy',
  magic: 'Fantasy',
  mystery: 'Mystery',
  detective: 'Mystery',
  crime: 'Mystery',
  thriller: 'Thriller',
  suspense: 'Thriller',
  romance: 'Romance',
  horror: 'Horror',
  gothic: 'Horror',
  biography: 'Biography',
  autobiography: 'Biography',
  memoir: 'Biography',
  history: 'History',
  science: 'Science',
  physics: 'Science',
  biology: 'Science',
  chemistry: 'Science',
  astronomy: 'Science',
  technology: 'Technology',
  computers: 'Technology',
  programming: 'Technology',
  engineering: 'Technology',
  self_help: 'Self-Help',
  'self-help': 'Self-Help',
  'self help': 'Self-Help',
  psychology: 'Self-Help',
  poetry: 'Poetry',
  poems: 'Poetry',
  drama: 'Drama',
  plays: 'Drama',
  comedy: 'Comedy',
  humor: 'Comedy',
  humour: 'Comedy',
  satire: 'Comedy',
  adventure: 'Adventure',
  children: 'Children',
  "children's literature": 'Children',
  juvenile: 'Children',
  young_adult: 'Young Adult',
  'young adult': 'Young Adult',
  teen: 'Young Adult',
  graphic_novels: 'Graphic Novel',
  'graphic novels': 'Graphic Novel',
  'graphic novel': 'Graphic Novel',
  comics: 'Graphic Novel',
  manga: 'Graphic Novel',
};

const GENRE_LOOKUP = new Map(
  GENRES.map((genre) => [genre.toLowerCase(), genre])
);

export function normalizeGenres(
  input: string[] | string | null | undefined
): string[] {
  const rawGenres = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];

  const normalized = rawGenres
    .map((genre) => genre.trim())
    .filter(Boolean)
    .map((genre) => {
      const lower = genre.toLowerCase();
      return GENRE_ALIASES[lower] ?? GENRE_LOOKUP.get(lower) ?? genre;
    });

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['Fiction'];
}

export function getPrimaryGenre(
  input: string[] | string | null | undefined
): string {
  return normalizeGenres(input)[0];
}
