/**
 * Knowledge Base Types for Conferbot React Native SDK
 */

// Author information for articles
export interface KBAuthor {
  _id: string;
  name: string;
  avatar?: string;
  email?: string;
}

// Category information
export interface KBCategory {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  articleCount?: number;
}

// Category with articles for display
export interface KBCategoryWithArticles extends KBCategory {
  articles: KBArticle[];
}

// Full article model
export interface KBArticle {
  _id: string;
  title: string;
  description: string;
  content: string;
  coverImage?: string;
  category?: KBCategory | string;
  categoryId?: string;
  categoryName?: string;
  author?: KBAuthor;
  approved: boolean;
  publishedDate?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;

  // Analytics fields
  viewCount?: number;
  uniqueViewCount?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  averageRating?: number;
  totalRatings?: number;

  // Reading metadata
  readingTime?: number;
  wordCount?: number;

  // AI generation fields
  aiGenerated?: boolean;
  seoKeywords?: string[];
  metaDescription?: string;
}

// Article view tracking payload
export interface ArticleViewPayload {
  articleId: string;
  visitorId?: string;
  sessionId?: string;
  referrer?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
}

// Article engagement tracking payload
export interface ArticleEngagementPayload {
  articleId: string;
  visitorId?: string;
  sessionId?: string;
  timeSpent: number;
  scrollDepth: number;
  isCompleted: boolean;
  device?: 'desktop' | 'mobile' | 'tablet';
}

// Article rating payload
export interface ArticleRatingPayload {
  articleId: string;
  visitorId?: string;
  sessionId?: string;
  helpful: boolean;
  rating?: number;
  feedback?: string;
}

// Knowledge Base state
export interface KBState {
  isLoading: boolean;
  categories: KBCategoryWithArticles[];
  selectedCategory: KBCategoryWithArticles | null;
  selectedArticle: KBArticle | null;
  searchQuery: string;
  searchResults: KBArticle[];
  viewedArticles: Set<string>;
  ratedArticles: Set<string>;
  error: string | null;
}

// Navigation types for KB screens
export type KBScreenType = 'categories' | 'articles' | 'detail' | 'search';

// Props for shared styling
export interface KBStyleProps {
  primaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  accentColor?: string;
}
