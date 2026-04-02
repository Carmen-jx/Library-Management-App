// Database types matching Supabase schema

export type UserRole = 'admin' | 'user';
export type BorrowStatus = 'borrowed' | 'returned' | 'overdue';
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  birthday: string | null;
  favorite_genres: string[];
  show_reading_activity: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  open_library_key: string | null;
  title: string;
  author: string;
  genre: string[];
  description: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown> | null;
  available: boolean;
  created_at: string;
}

export interface Borrow {
  id: string;
  user_id: string;
  book_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: BorrowStatus;
  book?: Book;
  profile?: Profile;
}

export interface Favorite {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
  book?: Book;
}

export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: ConnectionStatus;
  created_at: string;
  requester?: Profile;
  receiver?: Profile;
}

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  admin_response: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  assigned_admin?: Profile;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: UserRole;
  message: string;
  created_at: string;
  sender?: Profile;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile?: Profile;
}

// Open Library API types
export interface OpenLibraryWork {
  key: string; // e.g., "/works/OL45804W"
  title: string;
  author_name?: string[];
  author_key?: string[];
  subject?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number; // cover ID for covers.openlibrary.org
  edition_key?: string[];
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  ratings_average?: number;
  ratings_count?: number;
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryWork[];
}

// AI types
export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  cover_url?: string;
  open_library_key?: string;
}

export interface RecommendationCache {
  user_id: string;
  recommendations: BookRecommendation[];
  refreshed_at: string;
  created_at: string;
  updated_at: string;
}

export interface NLSearchResult {
  query: string;
  structured_params: {
    title?: string;
    author?: string;
    genres?: string[];
    genre?: string;
    keywords?: string[];
    concepts?: string[];
  };
  results: OpenLibraryWork[];
  ranked_results?: Array<{
    book: OpenLibraryWork;
    relevance_score: number;
    reason: string;
  }>;
}

// Notification types
export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_assigned';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile;
}

// Hybrid search types
export interface HybridSearchResult {
  book: Book;
  score: number;
  source: 'semantic' | 'keyword' | 'both';
}

// Conversation type for messaging
export interface Conversation {
  user: Profile;
  last_message: Message | null;
  unread_count: number;
}
