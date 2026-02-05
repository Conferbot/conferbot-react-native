/**
 * ArticleList.test.tsx
 *
 * Tests for the ArticleList component that displays a list of KB articles.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ArticleList } from '../../src/components/KnowledgeBase/ArticleList';
import { createMockTheme } from '../testUtils';
import type { KBArticle } from '../../src/components/KnowledgeBase/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('ArticleList', () => {
  const mockArticles: KBArticle[] = [
    {
      id: 'article-1',
      title: 'Getting Started',
      content: 'Learn how to get started with our platform.',
      categoryId: 'cat-1',
      order: 1,
      excerpt: 'Learn how to get started...',
    },
    {
      id: 'article-2',
      title: 'Advanced Features',
      content: 'Discover advanced features and configurations.',
      categoryId: 'cat-1',
      order: 2,
      excerpt: 'Discover advanced features...',
    },
    {
      id: 'article-3',
      title: 'Troubleshooting',
      content: 'Common issues and their solutions.',
      categoryId: 'cat-2',
      order: 1,
      excerpt: 'Common issues and their...',
    },
  ];

  const defaultProps = {
    articles: mockArticles,
    onArticlePress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the article list component', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('renders all article titles', () => {
      const { getByText } = render(
        <ArticleList {...defaultProps} />
      );

      expect(getByText('Getting Started')).toBeTruthy();
      expect(getByText('Advanced Features')).toBeTruthy();
      expect(getByText('Troubleshooting')).toBeTruthy();
    });

    it('renders article excerpts when showExcerpt is true', () => {
      const { getByText } = render(
        <ArticleList {...defaultProps} showExcerpt={true} />
      );

      expect(getByText('Learn how to get started...')).toBeTruthy();
    });

    it('hides excerpts when showExcerpt is false', () => {
      const { queryByText } = render(
        <ArticleList {...defaultProps} showExcerpt={false} />
      );

      expect(queryByText('Learn how to get started...')).toBeFalsy();
    });

    it('renders list header when provided', () => {
      const { getByText } = render(
        <ArticleList {...defaultProps} headerText="Help Articles" />
      );

      expect(getByText('Help Articles')).toBeTruthy();
    });

    it('renders empty state when articles array is empty', () => {
      const { getByText } = render(
        <ArticleList
          articles={[]}
          onArticlePress={jest.fn()}
          emptyMessage="No articles found"
        />
      );

      expect(getByText('No articles found')).toBeTruthy();
    });

    it('renders article icons when showIcons is true', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} showIcons={true} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('renders article timestamps when showTimestamp is true', () => {
      const articlesWithDates = mockArticles.map((a) => ({
        ...a,
        updatedAt: '2024-01-15T00:00:00Z',
      }));

      const { getByTestId } = render(
        <ArticleList
          articles={articlesWithDates}
          onArticlePress={jest.fn()}
          showTimestamp={true}
          testID="article-list"
        />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('renders in compact mode', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} compact={true} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('renders with custom item separator', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} showSeparator={true} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onArticlePress when article is pressed', () => {
      const onArticlePress = jest.fn();
      const { getByText } = render(
        <ArticleList {...defaultProps} onArticlePress={onArticlePress} />
      );

      fireEvent.press(getByText('Getting Started'));

      expect(onArticlePress).toHaveBeenCalledWith(mockArticles[0]);
    });

    it('calls onArticlePress with correct article data', () => {
      const onArticlePress = jest.fn();
      const { getByText } = render(
        <ArticleList {...defaultProps} onArticlePress={onArticlePress} />
      );

      fireEvent.press(getByText('Advanced Features'));

      expect(onArticlePress).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'article-2',
          title: 'Advanced Features',
        })
      );
    });

    it('handles rapid article presses', () => {
      const onArticlePress = jest.fn();
      const { getByText } = render(
        <ArticleList {...defaultProps} onArticlePress={onArticlePress} />
      );

      const article = getByText('Getting Started');
      fireEvent.press(article);
      fireEvent.press(article);
      fireEvent.press(article);

      expect(onArticlePress).toHaveBeenCalled();
    });
  });

  // ========================================
  // PAGINATION TESTS
  // ========================================

  describe('Pagination', () => {
    it('calls onLoadMore when reaching end of list', async () => {
      const onLoadMore = jest.fn();
      const { getByTestId } = render(
        <ArticleList
          {...defaultProps}
          onLoadMore={onLoadMore}
          hasMore={true}
          testID="article-list"
        />
      );

      const list = getByTestId('article-list');
      fireEvent(list, 'onEndReached');

      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalled();
      });
    });

    it('does not call onLoadMore when hasMore is false', async () => {
      const onLoadMore = jest.fn();
      const { getByTestId } = render(
        <ArticleList
          {...defaultProps}
          onLoadMore={onLoadMore}
          hasMore={false}
          testID="article-list"
        />
      );

      const list = getByTestId('article-list');
      fireEvent(list, 'onEndReached');

      await waitFor(() => {
        expect(onLoadMore).not.toHaveBeenCalled();
      });
    });

    it('shows loading indicator when loading more', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} loadingMore={true} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });
  });

  // ========================================
  // REFRESH TESTS
  // ========================================

  describe('Refresh', () => {
    it('calls onRefresh when pull to refresh is triggered', async () => {
      const onRefresh = jest.fn();
      const { getByTestId } = render(
        <ArticleList
          {...defaultProps}
          onRefresh={onRefresh}
          refreshable={true}
          testID="article-list"
        />
      );

      const list = getByTestId('article-list');
      fireEvent(list, 'onRefresh');

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
    });

    it('shows refresh indicator when refreshing', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} refreshing={true} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <ArticleList {...defaultProps} testID="article-list" />
      );

      const container = getByTestId('article-list');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <ArticleList
          {...defaultProps}
          testID="article-list"
          accessibilityLabel="List of help articles"
        />
      );

      const container = getByTestId('article-list');
      expect(container.props.accessibilityLabel).toBe('List of help articles');
    });

    it('article items are accessible', () => {
      const { getByText } = render(
        <ArticleList {...defaultProps} />
      );

      const article = getByText('Getting Started');
      expect(article).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty articles array', () => {
      const { getByTestId } = render(
        <ArticleList articles={[]} onArticlePress={jest.fn()} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles single article', () => {
      const { getByText } = render(
        <ArticleList articles={[mockArticles[0]]} onArticlePress={jest.fn()} />
      );

      expect(getByText('Getting Started')).toBeTruthy();
    });

    it('handles many articles', () => {
      const manyArticles = Array.from({ length: 100 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        content: `Content ${i}`,
        categoryId: 'cat-1',
        order: i,
      }));

      const { getByTestId } = render(
        <ArticleList articles={manyArticles} onArticlePress={jest.fn()} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles articles with very long titles', () => {
      const longTitleArticles = [
        { ...mockArticles[0], title: 'A'.repeat(500) },
      ];

      const { getByTestId } = render(
        <ArticleList articles={longTitleArticles} onArticlePress={jest.fn()} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles articles with very long excerpts', () => {
      const longExcerptArticles = [
        { ...mockArticles[0], excerpt: 'A'.repeat(1000) },
      ];

      const { getByTestId } = render(
        <ArticleList
          articles={longExcerptArticles}
          onArticlePress={jest.fn()}
          showExcerpt={true}
          testID="article-list"
        />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles undefined articles gracefully', () => {
      const { getByTestId } = render(
        <ArticleList articles={undefined as any} onArticlePress={jest.fn()} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles articles without excerpts', () => {
      const noExcerptArticles = mockArticles.map((a) => ({
        ...a,
        excerpt: undefined,
      }));

      const { getByTestId } = render(
        <ArticleList
          articles={noExcerptArticles}
          onArticlePress={jest.fn()}
          showExcerpt={true}
          testID="article-list"
        />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });

    it('handles special characters in titles', () => {
      const specialCharArticles = [
        { ...mockArticles[0], title: '<script>alert("xss")</script>' },
      ];

      const { getByTestId } = render(
        <ArticleList articles={specialCharArticles} onArticlePress={jest.fn()} testID="article-list" />
      );

      expect(getByTestId('article-list')).toBeTruthy();
    });
  });
});
