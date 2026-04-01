'use client';

import { Badge } from '@/components/ui/badge';
import { normalizeGenres } from '@/lib/utils';

interface GenreBadgesProps {
  genres: string[] | string | null | undefined;
  maxVisible?: number;
}

export function GenreBadges({
  genres,
  maxVisible = 2,
}: GenreBadgesProps) {
  const normalized = normalizeGenres(genres);
  const visible = normalized.slice(0, maxVisible);
  const remaining = normalized.length - visible.length;

  return (
    <>
      {visible.map((genre) => (
        <Badge key={genre}>{genre}</Badge>
      ))}
      {remaining > 0 && <Badge>+{remaining}</Badge>}
    </>
  );
}
