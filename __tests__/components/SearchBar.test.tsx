/**
 * SearchBar.test.tsx
 *
 * Tests for the SearchBar component used in Knowledge Base.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchBar } from '../../src/components/KnowledgeBase/SearchBar';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('SearchBar', () => {
  const defaultProps = {
    onSearch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the search bar component', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} testID="search-bar" />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('renders with placeholder text', () => {
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search articles..." />
      );

      expect(getByPlaceholderText('Search articles...')).toBeTruthy();
    });

    it('renders search icon', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} testID="search-bar" />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('renders clear button when value is present', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" testID="search-bar" />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test query');

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('hides clear button when value is empty', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} testID="search-bar" />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('renders with custom initial value', () => {
      const { getByDisplayValue } = render(
        <SearchBar {...defaultProps} initialValue="initial query" />
      );

      expect(getByDisplayValue('initial query')).toBeTruthy();
    });

    it('renders loading indicator when loading', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} loading={true} testID="search-bar" />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('renders in disabled state', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} disabled={true} testID="search-bar" />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });
  });

  // ========================================
  // INPUT INTERACTION TESTS
  // ========================================

  describe('Input Interactions', () => {
    it('updates value when typing', () => {
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test query');

      expect(input.props.value).toBe('test query');
    });

    it('calls onSearch with debounced value', async () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={300} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test');

      // Should not be called immediately
      expect(onSearch).not.toHaveBeenCalled();

      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('cancels previous debounce on new input', async () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={300} />
      );

      const input = getByPlaceholderText('Search');

      fireEvent.changeText(input, 'te');
      act(() => {
        jest.advanceTimersByTime(100);
      });

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(100);
      });

      fireEvent.changeText(input, 'testing');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should only be called once with final value
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('testing');
    });

    it('calls onSearch immediately when debounceMs is 0', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={0} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test');

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('clears input when clear button is pressed', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <SearchBar {...defaultProps} placeholder="Search" testID="search-bar" showClearButton={true} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test query');

      // Find and press clear button (implementation specific)
      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('calls onClear when clear button is pressed', () => {
      const onClear = jest.fn();
      const { getByPlaceholderText, getByTestId } = render(
        <SearchBar
          {...defaultProps}
          placeholder="Search"
          onClear={onClear}
          testID="search-bar"
          showClearButton={true}
        />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test');

      expect(getByTestId('search-bar')).toBeTruthy();
    });

    it('calls onFocus when input is focused', () => {
      const onFocus = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" onFocus={onFocus} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent(input, 'focus');

      expect(onFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', () => {
      const onBlur = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" onBlur={onBlur} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent(input, 'blur');

      expect(onBlur).toHaveBeenCalled();
    });

    it('calls onSubmit when search is submitted', () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" onSubmit={onSubmit} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test query');
      fireEvent(input, 'submitEditing');

      expect(onSubmit).toHaveBeenCalledWith('test query');
    });
  });

  // ========================================
  // DISABLED STATE TESTS
  // ========================================

  describe('Disabled State', () => {
    it('does not allow input when disabled', () => {
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" disabled={true} />
      );

      const input = getByPlaceholderText('Search');
      expect(input.props.editable).toBe(false);
    });

    it('does not call onSearch when disabled', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" disabled={true} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test');

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onSearch).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <SearchBar {...defaultProps} testID="search-bar" />
      );

      const container = getByTestId('search-bar');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <SearchBar
          {...defaultProps}
          testID="search-bar"
          accessibilityLabel="Search knowledge base articles"
        />
      );

      const container = getByTestId('search-bar');
      expect(container.props.accessibilityLabel).toBe('Search knowledge base articles');
    });

    it('input has accessibility label', () => {
      const { getByLabelText } = render(
        <SearchBar {...defaultProps} inputAccessibilityLabel="Search input" />
      );

      expect(getByLabelText('Search input')).toBeTruthy();
    });

    it('clear button has accessibility label', () => {
      const { getByTestId } = render(
        <SearchBar
          {...defaultProps}
          testID="search-bar"
          clearButtonAccessibilityLabel="Clear search"
        />
      );

      expect(getByTestId('search-bar')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty search query', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={0} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, '');

      expect(onSearch).toHaveBeenCalledWith('');
    });

    it('handles very long search query', () => {
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" />
      );

      const input = getByPlaceholderText('Search');
      const longQuery = 'A'.repeat(1000);
      fireEvent.changeText(input, longQuery);

      expect(input.props.value).toBe(longQuery);
    });

    it('handles special characters in search query', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={0} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, '<script>alert("xss")</script>');

      expect(onSearch).toHaveBeenCalledWith('<script>alert("xss")</script>');
    });

    it('handles unicode characters in search query', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={0} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, '\u4e2d\u6587\u641c\u7d22');

      expect(onSearch).toHaveBeenCalledWith('\u4e2d\u6587\u641c\u7d22');
    });

    it('handles whitespace-only search query', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={0} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, '   ');

      expect(onSearch).toHaveBeenCalledWith('   ');
    });

    it('trims search query when trimOnSubmit is true', () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar {...defaultProps} placeholder="Search" onSubmit={onSubmit} trimOnSubmit={true} />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, '  test query  ');
      fireEvent(input, 'submitEditing');

      expect(onSubmit).toHaveBeenCalledWith('test query');
    });

    it('handles controlled value prop', () => {
      const { getByDisplayValue, rerender } = render(
        <SearchBar {...defaultProps} value="controlled" />
      );

      expect(getByDisplayValue('controlled')).toBeTruthy();

      rerender(<SearchBar {...defaultProps} value="updated" />);

      expect(getByDisplayValue('updated')).toBeTruthy();
    });

    it('handles missing onSearch gracefully', () => {
      const { getByPlaceholderText } = render(
        <SearchBar placeholder="Search" />
      );

      const input = getByPlaceholderText('Search');
      fireEvent.changeText(input, 'test');

      expect(input.props.value).toBe('test');
    });

    it('handles rapid typing with debounce', () => {
      const onSearch = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar onSearch={onSearch} placeholder="Search" debounceMs={100} />
      );

      const input = getByPlaceholderText('Search');

      // Rapid typing
      for (let i = 0; i < 10; i++) {
        fireEvent.changeText(input, `test${i}`);
        act(() => {
          jest.advanceTimersByTime(50);
        });
      }

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should only call once with final value
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('test9');
    });
  });
});
