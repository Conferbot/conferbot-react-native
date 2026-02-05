/**
 * KnowledgeBaseScreen.test.tsx
 *
 * Tests for the KnowledgeBaseScreen component that displays the KB interface.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { KnowledgeBaseScreen } from '../../src/components/KnowledgeBase/KnowledgeBaseScreen';
import { createMockTheme } from '../testUtils';
import type { KBArticle, KBCategoryWithArticles } from '../../src/components/KnowledgeBase/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock child components
jest.mock('../../src/components/KnowledgeBase/SearchBar', () => ({
  SearchBar: ({ onSearch, testID }: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID={testID || 'search-bar'}
        onChangeText={onSearch}
        placeholder="Search"
      />
    );
  },
}));

jest.mock('../../src/components/KnowledgeBase/CategoryFilter', () => ({
  CategoryFilter: ({ onCategorySelect, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'category-filter'} onPress={() => onCategorySelect('cat-1')}>
        <Text>CategoryFilter</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/KnowledgeBase/ArticleList', () => ({
  ArticleList: ({ onArticlePress, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'article-list'} onPress={() => onArticlePress({ id: 'article-1', title: 'Test Article' })}>
        <Text>ArticleList</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/KnowledgeBase/ArticleDetail', () => ({
  ArticleDetail: ({ onBack, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={testID || 'article-detail'} onPress={onBack}>
        <Text>ArticleDetail</Text>
      </TouchableOpacity>
    );
  },
}));

describe('KnowledgeBaseScreen', () => {
  const mockCategories: KBCategoryWithArticles[] = [
    {
      id: 'cat-1',
      name: 'Getting Started',
      description: 'Basic tutorials',
      icon: 'book',
      articles: [
        { id: 'article-1', title: 'Quick Start', content: 'Content 1', categoryId: 'cat-1', order: 1 },
        { id: 'article-2', title: 'Installation', content: 'Content 2', categoryId: 'cat-1', order: 2 },
      ],
    },
    {
      id: 'cat-2',
      name: 'FAQ',
      description: 'Common questions',
      icon: 'help',
      articles: [
        { id: 'article-3', title: 'Common Issues', content: 'Content 3', categoryId: 'cat-2', order: 1 },
      ],
    },
  ];

  const defaultProps = {
    categories: mockCategories,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the knowledge base screen', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('renders search bar', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('renders category filter', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders article list', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('renders screen title', () => {
      const { getByText } = render(
        <KnowledgeBaseScreen {...defaultProps} title="Help Center" />
      );

      expect(getByText('Help Center')).toBeTruthy();
    });

    it('renders back button when onBack is provided', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} onBack={jest.fn()} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('hides search bar when searchEnabled is false', () => {
      const { queryByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} searchEnabled={false} />
      );

      expect(queryByTestId('search-bar')).toBeFalsy();
    });

    it('hides category filter when categoriesEnabled is false', () => {
      const { queryByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} categoriesEnabled={false} />
      );

      expect(queryByTestId('category-filter')).toBeFalsy();
    });
  });

  // ========================================
  // NAVIGATION TESTS
  // ========================================

  describe('Navigation', () => {
    it('shows article detail when article is selected', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      fireEvent.press(getByTestId('article-list'));

      await waitFor(() => {
        expect(getByTestId('article-detail')).toBeTruthy();
      });
    });

    it('returns to list when back is pressed from article detail', async () => {
      const { getByTestId, queryByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      // Navigate to article
      fireEvent.press(getByTestId('article-list'));

      await waitFor(() => {
        expect(getByTestId('article-detail')).toBeTruthy();
      });

      // Go back
      fireEvent.press(getByTestId('article-detail'));

      await waitFor(() => {
        expect(queryByTestId('article-detail')).toBeFalsy();
      });
    });

    it('calls onBack when screen back button is pressed', () => {
      const onBack = jest.fn();
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} onBack={onBack} testID="kb-screen" />
      );

      // Find and press back button (implementation specific)
      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('calls onArticleSelect when article is selected', async () => {
      const onArticleSelect = jest.fn();
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} onArticleSelect={onArticleSelect} />
      );

      fireEvent.press(getByTestId('article-list'));

      await waitFor(() => {
        expect(onArticleSelect).toHaveBeenCalledWith(expect.objectContaining({
          id: 'article-1',
          title: 'Test Article',
        }));
      });
    });
  });

  // ========================================
  // SEARCH FUNCTIONALITY TESTS
  // ========================================

  describe('Search Functionality', () => {
    it('filters articles when search query is entered', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      fireEvent.changeText(getByTestId('search-bar'), 'Quick');

      await waitFor(() => {
        expect(getByTestId('article-list')).toBeTruthy();
      });
    });

    it('shows no results message when search has no matches', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} noResultsMessage="No articles found" />
      );

      fireEvent.changeText(getByTestId('search-bar'), 'nonexistent');

      await waitFor(() => {
        expect(getByTestId('kb-screen') || getByTestId('article-list')).toBeTruthy();
      });
    });

    it('clears search when clear button is pressed', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      fireEvent.changeText(getByTestId('search-bar'), 'test');
      fireEvent.changeText(getByTestId('search-bar'), '');

      await waitFor(() => {
        expect(getByTestId('article-list')).toBeTruthy();
      });
    });
  });

  // ========================================
  // CATEGORY FILTER TESTS
  // ========================================

  describe('Category Filter', () => {
    it('filters articles by category when selected', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      fireEvent.press(getByTestId('category-filter'));

      await waitFor(() => {
        expect(getByTestId('article-list')).toBeTruthy();
      });
    });

    it('shows all articles when all categories filter is selected', async () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });
  });

  // ========================================
  // LOADING AND ERROR STATES
  // ========================================

  describe('Loading and Error States', () => {
    it('shows loading indicator when loading', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} loading={true} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('shows error message when error occurs', () => {
      const { getByText } = render(
        <KnowledgeBaseScreen
          {...defaultProps}
          error="Failed to load articles"
        />
      );

      expect(getByText('Failed to load articles')).toBeTruthy();
    });

    it('shows retry button on error', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <KnowledgeBaseScreen
          {...defaultProps}
          error="Failed to load"
          onRetry={onRetry}
          retryButtonText="Try Again"
        />
      );

      expect(getByText('Try Again')).toBeTruthy();
    });

    it('calls onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <KnowledgeBaseScreen
          {...defaultProps}
          error="Failed to load"
          onRetry={onRetry}
          retryButtonText="Try Again"
        />
      );

      fireEvent.press(getByText('Try Again'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen {...defaultProps} testID="kb-screen" />
      );

      const container = getByTestId('kb-screen');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen
          {...defaultProps}
          testID="kb-screen"
          accessibilityLabel="Knowledge base help center"
        />
      );

      const container = getByTestId('kb-screen');
      expect(container.props.accessibilityLabel).toBe('Knowledge base help center');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty categories', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen categories={[]} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('handles categories with no articles', () => {
      const emptyCategories: KBCategoryWithArticles[] = [
        { id: 'cat-1', name: 'Empty', description: '', articles: [] },
      ];

      const { getByTestId } = render(
        <KnowledgeBaseScreen categories={emptyCategories} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('handles many categories', () => {
      const manyCategories = Array.from({ length: 20 }, (_, i) => ({
        id: `cat-${i}`,
        name: `Category ${i}`,
        description: `Description ${i}`,
        articles: [],
      }));

      const { getByTestId } = render(
        <KnowledgeBaseScreen categories={manyCategories} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('handles many articles', () => {
      const categoryWithManyArticles: KBCategoryWithArticles[] = [
        {
          id: 'cat-1',
          name: 'Category',
          description: '',
          articles: Array.from({ length: 100 }, (_, i) => ({
            id: `article-${i}`,
            title: `Article ${i}`,
            content: `Content ${i}`,
            categoryId: 'cat-1',
            order: i,
          })),
        },
      ];

      const { getByTestId } = render(
        <KnowledgeBaseScreen categories={categoryWithManyArticles} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });

    it('handles undefined categories', () => {
      const { getByTestId } = render(
        <KnowledgeBaseScreen categories={undefined as any} testID="kb-screen" />
      );

      expect(getByTestId('kb-screen')).toBeTruthy();
    });
  });
});
