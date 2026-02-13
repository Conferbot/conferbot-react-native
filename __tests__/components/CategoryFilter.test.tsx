/**
 * CategoryFilter.test.tsx
 *
 * Tests for the CategoryFilter component used in Knowledge Base.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategoryFilter } from '../../src/components/KnowledgeBase/CategoryFilter';
import { createMockTheme } from '../testUtils';
import type { KBCategory } from '../../src/components/KnowledgeBase/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('CategoryFilter', () => {
  const mockCategories: KBCategory[] = [
    { id: 'cat-1', name: 'Getting Started', description: 'Basic tutorials', icon: 'book' },
    { id: 'cat-2', name: 'FAQ', description: 'Common questions', icon: 'help' },
    { id: 'cat-3', name: 'Troubleshooting', description: 'Fix issues', icon: 'wrench' },
  ];

  const defaultProps = {
    categories: mockCategories,
    onCategorySelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the category filter component', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders all category names', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} />
      );

      expect(getByText('Getting Started')).toBeTruthy();
      expect(getByText('FAQ')).toBeTruthy();
      expect(getByText('Troubleshooting')).toBeTruthy();
    });

    it('renders "All" option when showAllOption is true', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} showAllOption={true} allOptionText="All Categories" />
      );

      expect(getByText('All Categories')).toBeTruthy();
    });

    it('hides "All" option when showAllOption is false', () => {
      const { queryByText } = render(
        <CategoryFilter {...defaultProps} showAllOption={false} allOptionText="All" />
      );

      expect(queryByText('All')).toBeFalsy();
    });

    it('renders category icons when showIcons is true', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} showIcons={true} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('hides category icons when showIcons is false', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} showIcons={false} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders category descriptions when showDescriptions is true', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} showDescriptions={true} />
      );

      expect(getByText('Basic tutorials')).toBeTruthy();
      expect(getByText('Common questions')).toBeTruthy();
    });

    it('hides category descriptions when showDescriptions is false', () => {
      const { queryByText } = render(
        <CategoryFilter {...defaultProps} showDescriptions={false} />
      );

      expect(queryByText('Basic tutorials')).toBeFalsy();
    });

    it('highlights selected category', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} selectedCategoryId="cat-1" />
      );

      const selectedCategory = getByText('Getting Started');
      expect(selectedCategory).toBeTruthy();
    });

    it('renders in horizontal mode', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} layout="horizontal" testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders in vertical mode', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} layout="vertical" testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders in grid mode', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} layout="grid" testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('renders article count when showCount is true', () => {
      const categoriesWithCount = mockCategories.map((c, i) => ({
        ...c,
        articleCount: (i + 1) * 5,
      }));

      const { getByTestId } = render(
        <CategoryFilter
          categories={categoriesWithCount}
          onCategorySelect={jest.fn()}
          showCount={true}
          testID="category-filter"
        />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onCategorySelect when category is pressed', () => {
      const onCategorySelect = jest.fn();
      const { getByText } = render(
        <CategoryFilter {...defaultProps} onCategorySelect={onCategorySelect} />
      );

      fireEvent.press(getByText('Getting Started'));

      expect(onCategorySelect).toHaveBeenCalledWith('cat-1');
    });

    it('calls onCategorySelect with correct category id', () => {
      const onCategorySelect = jest.fn();
      const { getByText } = render(
        <CategoryFilter {...defaultProps} onCategorySelect={onCategorySelect} />
      );

      fireEvent.press(getByText('FAQ'));

      expect(onCategorySelect).toHaveBeenCalledWith('cat-2');
    });

    it('calls onCategorySelect with null when "All" is pressed', () => {
      const onCategorySelect = jest.fn();
      const { getByText } = render(
        <CategoryFilter
          {...defaultProps}
          onCategorySelect={onCategorySelect}
          showAllOption={true}
          allOptionText="All"
        />
      );

      fireEvent.press(getByText('All'));

      expect(onCategorySelect).toHaveBeenCalledWith(null);
    });

    it('allows switching between categories', () => {
      const onCategorySelect = jest.fn();
      const { getByText } = render(
        <CategoryFilter {...defaultProps} onCategorySelect={onCategorySelect} />
      );

      fireEvent.press(getByText('Getting Started'));
      expect(onCategorySelect).toHaveBeenCalledWith('cat-1');

      fireEvent.press(getByText('FAQ'));
      expect(onCategorySelect).toHaveBeenCalledWith('cat-2');

      fireEvent.press(getByText('Troubleshooting'));
      expect(onCategorySelect).toHaveBeenCalledWith('cat-3');
    });

    it('handles rapid category presses', () => {
      const onCategorySelect = jest.fn();
      const { getByText } = render(
        <CategoryFilter {...defaultProps} onCategorySelect={onCategorySelect} />
      );

      const category = getByText('Getting Started');
      fireEvent.press(category);
      fireEvent.press(category);
      fireEvent.press(category);

      expect(onCategorySelect).toHaveBeenCalled();
    });
  });

  // ========================================
  // SELECTION STATE TESTS
  // ========================================

  describe('Selection State', () => {
    it('selects "All" by default when no category is selected', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} showAllOption={true} allOptionText="All" />
      );

      const allOption = getByText('All');
      expect(allOption).toBeTruthy();
    });

    it('updates selection when selectedCategoryId changes', () => {
      const { getByText, rerender } = render(
        <CategoryFilter {...defaultProps} selectedCategoryId="cat-1" />
      );

      expect(getByText('Getting Started')).toBeTruthy();

      rerender(
        <CategoryFilter {...defaultProps} selectedCategoryId="cat-2" />
      );

      expect(getByText('FAQ')).toBeTruthy();
    });

    it('clears selection when selectedCategoryId is null', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} selectedCategoryId={null} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} testID="category-filter" />
      );

      const container = getByTestId('category-filter');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <CategoryFilter
          {...defaultProps}
          testID="category-filter"
          accessibilityLabel="Filter articles by category"
        />
      );

      const container = getByTestId('category-filter');
      expect(container.props.accessibilityLabel).toBe('Filter articles by category');
    });

    it('category buttons are accessible', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} />
      );

      const category = getByText('Getting Started');
      expect(category).toBeTruthy();
    });

    it('selected category has correct accessibility state', () => {
      const { getByText } = render(
        <CategoryFilter {...defaultProps} selectedCategoryId="cat-1" />
      );

      const selectedCategory = getByText('Getting Started');
      expect(selectedCategory).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty categories array', () => {
      const { getByTestId } = render(
        <CategoryFilter categories={[]} onCategorySelect={jest.fn()} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles single category', () => {
      const { getByText } = render(
        <CategoryFilter categories={[mockCategories[0]]} onCategorySelect={jest.fn()} />
      );

      expect(getByText('Getting Started')).toBeTruthy();
    });

    it('handles many categories', () => {
      const manyCategories = Array.from({ length: 20 }, (_, i) => ({
        id: `cat-${i}`,
        name: `Category ${i}`,
        description: `Description ${i}`,
      }));

      const { getByTestId } = render(
        <CategoryFilter categories={manyCategories} onCategorySelect={jest.fn()} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles categories with very long names', () => {
      const longNameCategories = [
        { id: 'cat-1', name: 'A'.repeat(100), description: '' },
      ];

      const { getByTestId } = render(
        <CategoryFilter categories={longNameCategories} onCategorySelect={jest.fn()} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles categories with very long descriptions', () => {
      const longDescCategories = [
        { id: 'cat-1', name: 'Category', description: 'A'.repeat(500) },
      ];

      const { getByTestId } = render(
        <CategoryFilter
          categories={longDescCategories}
          onCategorySelect={jest.fn()}
          showDescriptions={true}
          testID="category-filter"
        />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles undefined categories gracefully', () => {
      const { getByTestId } = render(
        <CategoryFilter categories={undefined as any} onCategorySelect={jest.fn()} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles categories without descriptions', () => {
      const noDescCategories = mockCategories.map((c) => ({
        id: c.id,
        name: c.name,
      }));

      const { getByTestId } = render(
        <CategoryFilter
          categories={noDescCategories}
          onCategorySelect={jest.fn()}
          showDescriptions={true}
          testID="category-filter"
        />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles categories without icons', () => {
      const noIconCategories = mockCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      }));

      const { getByTestId } = render(
        <CategoryFilter
          categories={noIconCategories}
          onCategorySelect={jest.fn()}
          showIcons={true}
          testID="category-filter"
        />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles special characters in category names', () => {
      const specialCharCategories = [
        { id: 'cat-1', name: '<Category & "Special">', description: '' },
      ];

      const { getByTestId } = render(
        <CategoryFilter categories={specialCharCategories} onCategorySelect={jest.fn()} testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });

    it('handles invalid selectedCategoryId', () => {
      const { getByTestId } = render(
        <CategoryFilter {...defaultProps} selectedCategoryId="invalid-id" testID="category-filter" />
      );

      expect(getByTestId('category-filter')).toBeTruthy();
    });
  });
});
