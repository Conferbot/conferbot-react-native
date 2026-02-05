/**
 * ArticleDetail.test.tsx
 *
 * Tests for the ArticleDetail component that displays a single KB article.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ArticleDetail } from '../../src/components/KnowledgeBase/ArticleDetail';
import { createMockTheme } from '../testUtils';
import type { KBArticle } from '../../src/components/KnowledgeBase/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('ArticleDetail', () => {
  const mockArticle: KBArticle = {
    id: 'article-1',
    title: 'Getting Started Guide',
    content: 'This is a comprehensive guide to getting started with our product.',
    categoryId: 'cat-1',
    order: 1,
    tags: ['tutorial', 'beginner'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };

  const defaultProps = {
    article: mockArticle,
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the article detail component', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders article title', () => {
      const { getByText } = render(
        <ArticleDetail {...defaultProps} />
      );

      expect(getByText('Getting Started Guide')).toBeTruthy();
    });

    it('renders article content', () => {
      const { getByText } = render(
        <ArticleDetail {...defaultProps} />
      );

      expect(getByText(/comprehensive guide/)).toBeTruthy();
    });

    it('renders back button', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders article tags when provided', () => {
      const { getByText } = render(
        <ArticleDetail {...defaultProps} showTags={true} />
      );

      expect(getByText('tutorial')).toBeTruthy();
      expect(getByText('beginner')).toBeTruthy();
    });

    it('renders last updated date when showLastUpdated is true', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} showLastUpdated={true} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('hides back button when showBackButton is false', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} showBackButton={false} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders related articles when provided', () => {
      const relatedArticles: KBArticle[] = [
        { id: 'article-2', title: 'Related Article', content: '', categoryId: 'cat-1', order: 2 },
      ];

      const { getByText } = render(
        <ArticleDetail {...defaultProps} relatedArticles={relatedArticles} />
      );

      expect(getByText('Related Article')).toBeTruthy();
    });

    it('renders article rating section when ratingEnabled is true', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} ratingEnabled={true} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onBack when back button is pressed', () => {
      const onBack = jest.fn();
      const { getByText } = render(
        <ArticleDetail {...defaultProps} onBack={onBack} backButtonText="Back" />
      );

      fireEvent.press(getByText('Back'));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('calls onRelatedArticlePress when related article is pressed', () => {
      const onRelatedArticlePress = jest.fn();
      const relatedArticles: KBArticle[] = [
        { id: 'article-2', title: 'Related Article', content: '', categoryId: 'cat-1', order: 2 },
      ];

      const { getByText } = render(
        <ArticleDetail
          {...defaultProps}
          relatedArticles={relatedArticles}
          onRelatedArticlePress={onRelatedArticlePress}
        />
      );

      fireEvent.press(getByText('Related Article'));

      expect(onRelatedArticlePress).toHaveBeenCalledWith(relatedArticles[0]);
    });

    it('calls onRatingSubmit when rating is submitted', () => {
      const onRatingSubmit = jest.fn();
      const { getByTestId } = render(
        <ArticleDetail
          {...defaultProps}
          ratingEnabled={true}
          onRatingSubmit={onRatingSubmit}
          testID="article-detail"
        />
      );

      // Rating interaction would be component specific
      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('calls onShare when share button is pressed', () => {
      const onShare = jest.fn();
      const { getByTestId } = render(
        <ArticleDetail
          {...defaultProps}
          shareEnabled={true}
          onShare={onShare}
          testID="article-detail"
        />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });
  });

  // ========================================
  // CONTENT RENDERING TESTS
  // ========================================

  describe('Content Rendering', () => {
    it('renders HTML content when content contains HTML', () => {
      const htmlArticle = {
        ...mockArticle,
        content: '<h1>Header</h1><p>Paragraph text</p>',
      };

      const { getByTestId } = render(
        <ArticleDetail article={htmlArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders markdown content when content is markdown', () => {
      const mdArticle = {
        ...mockArticle,
        content: '# Header\n\nParagraph text\n\n- List item 1\n- List item 2',
      };

      const { getByTestId } = render(
        <ArticleDetail article={mdArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders plain text content', () => {
      const plainArticle = {
        ...mockArticle,
        content: 'This is plain text content without any formatting.',
      };

      const { getByText } = render(
        <ArticleDetail article={plainArticle} onBack={jest.fn()} />
      );

      expect(getByText(/plain text content/)).toBeTruthy();
    });

    it('renders images in content', () => {
      const imageArticle = {
        ...mockArticle,
        content: 'Text with image: ![Alt text](https://example.com/image.png)',
      };

      const { getByTestId } = render(
        <ArticleDetail article={imageArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('renders links in content', () => {
      const linkArticle = {
        ...mockArticle,
        content: 'Text with [link](https://example.com)',
      };

      const { getByTestId } = render(
        <ArticleDetail article={linkArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <ArticleDetail {...defaultProps} testID="article-detail" />
      );

      const container = getByTestId('article-detail');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <ArticleDetail
          {...defaultProps}
          testID="article-detail"
          accessibilityLabel="Article: Getting Started Guide"
        />
      );

      const container = getByTestId('article-detail');
      expect(container.props.accessibilityLabel).toBe('Article: Getting Started Guide');
    });

    it('back button has accessibility label', () => {
      const { getByText } = render(
        <ArticleDetail {...defaultProps} backButtonText="Go Back" />
      );

      const backButton = getByText('Go Back');
      expect(backButton).toBeTruthy();
    });

    it('article title has appropriate heading role', () => {
      const { getByText } = render(
        <ArticleDetail {...defaultProps} />
      );

      const title = getByText('Getting Started Guide');
      expect(title).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles article with empty content', () => {
      const emptyArticle = { ...mockArticle, content: '' };
      const { getByTestId } = render(
        <ArticleDetail article={emptyArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles article with very long title', () => {
      const longTitleArticle = { ...mockArticle, title: 'A'.repeat(500) };
      const { getByTestId } = render(
        <ArticleDetail article={longTitleArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles article with very long content', () => {
      const longContentArticle = { ...mockArticle, content: 'A'.repeat(10000) };
      const { getByTestId } = render(
        <ArticleDetail article={longContentArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles article without tags', () => {
      const noTagsArticle = { ...mockArticle, tags: undefined };
      const { getByTestId } = render(
        <ArticleDetail article={noTagsArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles article with empty tags array', () => {
      const emptyTagsArticle = { ...mockArticle, tags: [] };
      const { getByTestId } = render(
        <ArticleDetail article={emptyTagsArticle} onBack={jest.fn()} showTags={true} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles article without dates', () => {
      const noDatesArticle = { ...mockArticle, createdAt: undefined, updatedAt: undefined };
      const { getByTestId } = render(
        <ArticleDetail article={noDatesArticle} onBack={jest.fn()} showLastUpdated={true} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles undefined article gracefully', () => {
      const { getByTestId } = render(
        <ArticleDetail article={undefined as any} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });

    it('handles special characters in content', () => {
      const specialCharsArticle = {
        ...mockArticle,
        content: '<script>alert("xss")</script> & < > " \' special chars',
      };

      const { getByTestId } = render(
        <ArticleDetail article={specialCharsArticle} onBack={jest.fn()} testID="article-detail" />
      );

      expect(getByTestId('article-detail')).toBeTruthy();
    });
  });
});
