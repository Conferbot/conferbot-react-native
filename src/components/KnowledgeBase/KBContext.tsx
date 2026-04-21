/**
 * Knowledge Base Context Provider
 *
 * Manages KB state, API calls, and analytics tracking
 */
import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import type {
  KBState,
  KBCategoryWithArticles,
  KBArticle,
  ArticleViewPayload,
  ArticleEngagementPayload,
} from './types';
import { useConferBot } from '../../context/ConferBotContext';

// Action types
type KBAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CATEGORIES'; payload: KBCategoryWithArticles[] }
  | { type: 'SET_SELECTED_CATEGORY'; payload: KBCategoryWithArticles | null }
  | { type: 'SET_SELECTED_ARTICLE'; payload: KBArticle | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: KBArticle[] }
  | { type: 'MARK_ARTICLE_VIEWED'; payload: string }
  | { type: 'MARK_ARTICLE_RATED'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

// Initial state
const initialState: KBState = {
  isLoading: false,
  categories: [],
  selectedCategory: null,
  selectedArticle: null,
  searchQuery: '',
  searchResults: [],
  viewedArticles: new Set(),
  ratedArticles: new Set(),
  error: null,
};

// Reducer
function kbReducer(state: KBState, action: KBAction): KBState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload, isLoading: false };
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SELECTED_ARTICLE':
      return { ...state, selectedArticle: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    case 'MARK_ARTICLE_VIEWED':
      return {
        ...state,
        viewedArticles: new Set([...state.viewedArticles, action.payload]),
      };
    case 'MARK_ARTICLE_RATED':
      return {
        ...state,
        ratedArticles: new Set([...state.ratedArticles, action.payload]),
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// Context interface
interface KBContextValue extends KBState {
  // Navigation
  selectCategory: (category: KBCategoryWithArticles | null) => void;
  selectArticle: (article: KBArticle | null) => void;

  // Search
  search: (query: string) => void;
  clearSearch: () => void;

  // Analytics
  trackArticleView: (article: KBArticle) => void;
  trackEngagement: (articleId: string, timeSpent: number, scrollDepth: number) => void;
  rateArticle: (articleId: string, helpful: boolean) => Promise<boolean>;

  // Data
  loadKnowledgeBase: () => Promise<void>;
  getAllArticles: () => KBArticle[];
  getRelatedArticles: (article: KBArticle, limit?: number) => KBArticle[];

  // Utilities
  calculateReadingTime: (content: string) => string;
  hasRatedArticle: (articleId: string) => boolean;
}

// Create context
const KBContext = createContext<KBContextValue | null>(null);

// Provider props
interface KBProviderProps {
  children: React.ReactNode;
}

// Get device type
const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  // React Native is always mobile or tablet
  return 'mobile';
};

/**
 * Knowledge Base Provider Component
 */
export const KBProvider: React.FC<KBProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(kbReducer, initialState);
  const { chatSessionId, rateKBArticle } = useConferBot();

  // Track engagement for current article
  const engagementRef = useRef<{
    articleId: string | null;
    startTime: number;
    maxScrollDepth: number;
  }>({
    articleId: null,
    startTime: 0,
    maxScrollDepth: 0,
  });

  // Socket reference for analytics events
  const socketRef = useRef<any>(null);

  // Load knowledge base data
  const loadKnowledgeBase = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Get the socket and fetch KB data
      // This will be called when KB screen opens
      // For now, we simulate with the socket event
      // The actual data will come from the socket 'fetched-chatbot-data' event

      // Emit request for KB data
      if (socketRef.current) {
        socketRef.current.emit('get-chatbot-data');
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load knowledge base' });
    }
  }, []);

  // Set KB data (called when data is received)
  const setKBData = useCallback((categories: KBCategoryWithArticles[]) => {
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
  }, []);

  // Navigation - select category
  const selectCategory = useCallback((category: KBCategoryWithArticles | null) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category });
    dispatch({ type: 'SET_SELECTED_ARTICLE', payload: null });
  }, []);

  // Navigation - select article
  const selectArticle = useCallback((article: KBArticle | null) => {
    dispatch({ type: 'SET_SELECTED_ARTICLE', payload: article });
  }, []);

  // Search articles
  const search = useCallback(
    (query: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query });

      if (!query.trim()) {
        dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
        return;
      }

      const queryLower = query.toLowerCase().trim();
      const allArticles = getAllArticlesInternal(state.categories);

      const results = allArticles.filter(
        (article) =>
          article.title?.toLowerCase().includes(queryLower) ||
          article.description?.toLowerCase().includes(queryLower) ||
          article.content?.toLowerCase().includes(queryLower)
      );

      dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
    },
    [state.categories]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
  }, []);

  // Track article view (once per session per article)
  const trackArticleView = useCallback(
    (article: KBArticle) => {
      if (!article?._id || state.viewedArticles.has(article._id)) {
        return;
      }

      dispatch({ type: 'MARK_ARTICLE_VIEWED', payload: article._id });

      // Start engagement tracking
      engagementRef.current = {
        articleId: article._id,
        startTime: Date.now(),
        maxScrollDepth: 0,
      };

      // Emit view event via socket
      if (socketRef.current) {
        const payload: ArticleViewPayload = {
          articleId: article._id,
          sessionId: chatSessionId,
          device: getDeviceType(),
        };
        socketRef.current.emit('track-article-view', payload);
      }
    },
    [state.viewedArticles, chatSessionId]
  );

  // Track engagement (time spent, scroll depth)
  const trackEngagement = useCallback(
    (articleId: string, timeSpent: number, scrollDepth: number) => {
      if (!articleId) return;

      // Update max scroll depth
      if (engagementRef.current.articleId === articleId) {
        engagementRef.current.maxScrollDepth = Math.max(
          engagementRef.current.maxScrollDepth,
          scrollDepth
        );
      }

      // Only send if enough time has passed (at least 2 seconds)
      if (timeSpent < 2) return;

      // Emit engagement event
      if (socketRef.current) {
        const payload: ArticleEngagementPayload = {
          articleId,
          sessionId: chatSessionId,
          timeSpent,
          scrollDepth: Math.round(scrollDepth),
          isCompleted: scrollDepth >= 90,
          device: getDeviceType(),
        };
        socketRef.current.emit('track-article-engagement', payload);
      }
    },
    [chatSessionId]
  );

  // Rate article
  const rateArticle = useCallback(
    async (articleId: string, helpful: boolean): Promise<boolean> => {
      if (!articleId || state.ratedArticles.has(articleId)) {
        return false;
      }

      dispatch({ type: 'MARK_ARTICLE_RATED', payload: articleId });

      // Emit rating event via ConferBot context socket
      rateKBArticle(articleId, helpful, helpful ? 5 : 1);

      return true;
    },
    [state.ratedArticles, rateKBArticle]
  );

  // Get all articles from all categories
  const getAllArticles = useCallback((): KBArticle[] => {
    return getAllArticlesInternal(state.categories);
  }, [state.categories]);

  // Get related articles
  const getRelatedArticles = useCallback(
    (article: KBArticle, limit: number = 3): KBArticle[] => {
      const allArticles = getAllArticlesInternal(state.categories);

      // Filter out current article and prioritize same category
      const related = allArticles
        .filter((a) => a._id !== article._id)
        .sort((a, b) => {
          const aInCategory = a.categoryId === state.selectedCategory?._id ? 1 : 0;
          const bInCategory = b.categoryId === state.selectedCategory?._id ? 1 : 0;
          return bInCategory - aInCategory;
        })
        .slice(0, limit);

      return related;
    },
    [state.categories, state.selectedCategory]
  );

  // Calculate reading time
  const calculateReadingTime = useCallback((content: string): string => {
    if (!content) return '1 min read';
    const text = content.replace(/<[^>]*>/g, ''); // Strip HTML
    const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
    const minutes = Math.ceil(wordCount / 200);
    return minutes <= 1 ? '1 min read' : `${minutes} min read`;
  }, []);

  // Check if article has been rated
  const hasRatedArticle = useCallback(
    (articleId: string): boolean => {
      return state.ratedArticles.has(articleId);
    },
    [state.ratedArticles]
  );

  // Context value
  const value: KBContextValue = {
    ...state,
    selectCategory,
    selectArticle,
    search,
    clearSearch,
    trackArticleView,
    trackEngagement,
    rateArticle,
    loadKnowledgeBase,
    getAllArticles,
    getRelatedArticles,
    calculateReadingTime,
    hasRatedArticle,
  };

  return <KBContext.Provider value={value}>{children}</KBContext.Provider>;
};

// Hook to use KB context
export const useKB = (): KBContextValue => {
  const context = useContext(KBContext);
  if (!context) {
    throw new Error('useKB must be used within a KBProvider');
  }
  return context;
};

// Helper function to get all articles from categories
function getAllArticlesInternal(categories: KBCategoryWithArticles[]): KBArticle[] {
  const articles: KBArticle[] = [];

  categories.forEach((category) => {
    category.articles?.forEach((article) => {
      articles.push({
        ...article,
        categoryName: category.name,
        categoryId: category._id,
      });
    });
  });

  return articles;
}

export default KBContext;
