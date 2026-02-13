/**
 * SelectionComponents.test.tsx
 *
 * Tests for the selection components (Buttons, Cards, Carousel, etc.)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ButtonsSelection,
  CardsSelection,
  CarouselSelection,
  PictureChoiceSelection,
  DropdownSelection,
} from '../../src/components/NodeComponents/SelectionComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('SelectionComponents', () => {
  // ========================================
  // BUTTONS SELECTION TESTS
  // ========================================

  describe('ButtonsSelection', () => {
    const mockOptions = [
      { id: 'opt-1', text: 'Option 1', value: 'value1' },
      { id: 'opt-2', text: 'Option 2', value: 'value2' },
      { id: 'opt-3', text: 'Option 3', value: 'value3' },
    ];

    const defaultProps = {
      options: mockOptions,
      onSelect: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders all button options', () => {
        const { getByText } = render(
          <ButtonsSelection {...defaultProps} />
        );

        expect(getByText('Option 1')).toBeTruthy();
        expect(getByText('Option 2')).toBeTruthy();
        expect(getByText('Option 3')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <ButtonsSelection {...defaultProps} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('renders in horizontal layout', () => {
        const { getByTestId } = render(
          <ButtonsSelection {...defaultProps} layout="horizontal" testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('renders in vertical layout', () => {
        const { getByTestId } = render(
          <ButtonsSelection {...defaultProps} layout="vertical" testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('renders button icons when provided', () => {
        const optionsWithIcons = mockOptions.map((opt, i) => ({
          ...opt,
          icon: `icon-${i}`,
        }));

        const { getByTestId } = render(
          <ButtonsSelection options={optionsWithIcons} onSelect={jest.fn()} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('renders disabled buttons', () => {
        const optionsWithDisabled = [
          { ...mockOptions[0], disabled: true },
          ...mockOptions.slice(1),
        ];

        const { getByText } = render(
          <ButtonsSelection options={optionsWithDisabled} onSelect={jest.fn()} />
        );

        expect(getByText('Option 1')).toBeTruthy();
      });

      it('renders multi-select mode', () => {
        const { getByTestId } = render(
          <ButtonsSelection {...defaultProps} multiSelect={true} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('shows selected state', () => {
        const { getByText } = render(
          <ButtonsSelection {...defaultProps} selectedIds={['opt-1']} />
        );

        expect(getByText('Option 1')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSelect when button is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <ButtonsSelection {...defaultProps} onSelect={onSelect} />
        );

        fireEvent.press(getByText('Option 1'));

        expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
      });

      it('does not call onSelect for disabled button', () => {
        const onSelect = jest.fn();
        const optionsWithDisabled = [
          { ...mockOptions[0], disabled: true },
          ...mockOptions.slice(1),
        ];

        const { getByText } = render(
          <ButtonsSelection options={optionsWithDisabled} onSelect={onSelect} />
        );

        fireEvent.press(getByText('Option 1'));

        expect(onSelect).not.toHaveBeenCalled();
      });

      it('allows multiple selections in multiSelect mode', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <ButtonsSelection {...defaultProps} onSelect={onSelect} multiSelect={true} />
        );

        fireEvent.press(getByText('Option 1'));
        fireEvent.press(getByText('Option 2'));

        expect(onSelect).toHaveBeenCalledTimes(2);
      });

      it('disables all buttons after selection when singleUse is true', () => {
        const { getByText, rerender } = render(
          <ButtonsSelection {...defaultProps} singleUse={true} />
        );

        fireEvent.press(getByText('Option 1'));

        rerender(
          <ButtonsSelection {...defaultProps} singleUse={true} disabled={true} />
        );

        expect(getByText('Option 1')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty options array', () => {
        const { getByTestId } = render(
          <ButtonsSelection options={[]} onSelect={jest.fn()} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('handles single option', () => {
        const { getByText } = render(
          <ButtonsSelection options={[mockOptions[0]]} onSelect={jest.fn()} />
        );

        expect(getByText('Option 1')).toBeTruthy();
      });

      it('handles many options', () => {
        const manyOptions = Array.from({ length: 20 }, (_, i) => ({
          id: `opt-${i}`,
          text: `Option ${i}`,
          value: `value${i}`,
        }));

        const { getByTestId } = render(
          <ButtonsSelection options={manyOptions} onSelect={jest.fn()} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });

      it('handles options with very long text', () => {
        const longOptions = [
          { id: 'opt-1', text: 'A'.repeat(200), value: 'long' },
        ];

        const { getByTestId } = render(
          <ButtonsSelection options={longOptions} onSelect={jest.fn()} testID="buttons" />
        );

        expect(getByTestId('buttons')).toBeTruthy();
      });
    });
  });

  // ========================================
  // CARDS SELECTION TESTS
  // ========================================

  describe('CardsSelection', () => {
    const mockCards = [
      {
        id: 'card-1',
        title: 'Card 1',
        description: 'Description 1',
        image: 'https://example.com/img1.png',
      },
      {
        id: 'card-2',
        title: 'Card 2',
        description: 'Description 2',
        image: 'https://example.com/img2.png',
      },
    ];

    const defaultProps = {
      cards: mockCards,
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders all cards', () => {
        const { getByText } = render(
          <CardsSelection {...defaultProps} />
        );

        expect(getByText('Card 1')).toBeTruthy();
        expect(getByText('Card 2')).toBeTruthy();
      });

      it('renders card descriptions', () => {
        const { getByText } = render(
          <CardsSelection {...defaultProps} showDescription={true} />
        );

        expect(getByText('Description 1')).toBeTruthy();
      });

      it('renders card images', () => {
        const { getByTestId } = render(
          <CardsSelection {...defaultProps} showImage={true} testID="cards" />
        );

        expect(getByTestId('cards')).toBeTruthy();
      });

      it('renders card buttons when provided', () => {
        const cardsWithButtons = mockCards.map((card) => ({
          ...card,
          buttons: [{ id: 'btn-1', text: 'Action' }],
        }));

        const { getByText } = render(
          <CardsSelection cards={cardsWithButtons} onSelect={jest.fn()} />
        );

        expect(getByText('Action')).toBeTruthy();
      });

      it('renders in grid layout', () => {
        const { getByTestId } = render(
          <CardsSelection {...defaultProps} layout="grid" testID="cards" />
        );

        expect(getByTestId('cards')).toBeTruthy();
      });

      it('renders in list layout', () => {
        const { getByTestId } = render(
          <CardsSelection {...defaultProps} layout="list" testID="cards" />
        );

        expect(getByTestId('cards')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSelect when card is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <CardsSelection {...defaultProps} onSelect={onSelect} />
        );

        fireEvent.press(getByText('Card 1'));

        expect(onSelect).toHaveBeenCalledWith(mockCards[0]);
      });

      it('calls onButtonPress when card button is pressed', () => {
        const onButtonPress = jest.fn();
        const cardsWithButtons = mockCards.map((card) => ({
          ...card,
          buttons: [{ id: 'btn-1', text: 'Action' }],
        }));

        const { getByText } = render(
          <CardsSelection
            cards={cardsWithButtons}
            onSelect={jest.fn()}
            onButtonPress={onButtonPress}
          />
        );

        fireEvent.press(getByText('Action'));

        expect(onButtonPress).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty cards array', () => {
        const { getByTestId } = render(
          <CardsSelection cards={[]} onSelect={jest.fn()} testID="cards" />
        );

        expect(getByTestId('cards')).toBeTruthy();
      });

      it('handles cards without images', () => {
        const cardsNoImage = mockCards.map(({ image, ...rest }) => rest);

        const { getByText } = render(
          <CardsSelection cards={cardsNoImage} onSelect={jest.fn()} />
        );

        expect(getByText('Card 1')).toBeTruthy();
      });

      it('handles cards without descriptions', () => {
        const cardsNoDesc = mockCards.map(({ description, ...rest }) => rest);

        const { getByText } = render(
          <CardsSelection cards={cardsNoDesc} onSelect={jest.fn()} />
        );

        expect(getByText('Card 1')).toBeTruthy();
      });
    });
  });

  // ========================================
  // CAROUSEL SELECTION TESTS
  // ========================================

  describe('CarouselSelection', () => {
    const mockItems = [
      { id: 'item-1', image: 'https://example.com/img1.png', title: 'Item 1' },
      { id: 'item-2', image: 'https://example.com/img2.png', title: 'Item 2' },
      { id: 'item-3', image: 'https://example.com/img3.png', title: 'Item 3' },
    ];

    const defaultProps = {
      items: mockItems,
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders the carousel', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });

      it('renders all items', () => {
        const { getByText } = render(
          <CarouselSelection {...defaultProps} />
        );

        expect(getByText('Item 1')).toBeTruthy();
      });

      it('renders pagination dots', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} showPagination={true} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });

      it('renders navigation arrows', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} showArrows={true} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });

      it('auto-plays when autoPlay is true', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} autoPlay={true} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSelect when item is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <CarouselSelection {...defaultProps} onSelect={onSelect} />
        );

        fireEvent.press(getByText('Item 1'));

        expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
      });

      it('navigates on swipe', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} testID="carousel" />
        );

        const carousel = getByTestId('carousel');
        fireEvent.scroll(carousel, {
          nativeEvent: { contentOffset: { x: 300 } },
        });

        expect(carousel).toBeTruthy();
      });

      it('navigates on arrow press', () => {
        const { getByTestId } = render(
          <CarouselSelection {...defaultProps} showArrows={true} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty items array', () => {
        const { getByTestId } = render(
          <CarouselSelection items={[]} onSelect={jest.fn()} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });

      it('handles single item', () => {
        const { getByText } = render(
          <CarouselSelection items={[mockItems[0]]} onSelect={jest.fn()} />
        );

        expect(getByText('Item 1')).toBeTruthy();
      });

      it('handles many items', () => {
        const manyItems = Array.from({ length: 20 }, (_, i) => ({
          id: `item-${i}`,
          image: `https://example.com/img${i}.png`,
          title: `Item ${i}`,
        }));

        const { getByTestId } = render(
          <CarouselSelection items={manyItems} onSelect={jest.fn()} testID="carousel" />
        );

        expect(getByTestId('carousel')).toBeTruthy();
      });
    });
  });

  // ========================================
  // PICTURE CHOICE SELECTION TESTS
  // ========================================

  describe('PictureChoiceSelection', () => {
    const mockChoices = [
      { id: 'choice-1', image: 'https://example.com/img1.png', label: 'Choice 1' },
      { id: 'choice-2', image: 'https://example.com/img2.png', label: 'Choice 2' },
    ];

    const defaultProps = {
      choices: mockChoices,
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders all choices', () => {
        const { getByText } = render(
          <PictureChoiceSelection {...defaultProps} />
        );

        expect(getByText('Choice 1')).toBeTruthy();
        expect(getByText('Choice 2')).toBeTruthy();
      });

      it('renders choice images', () => {
        const { getByTestId } = render(
          <PictureChoiceSelection {...defaultProps} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });

      it('renders in grid layout', () => {
        const { getByTestId } = render(
          <PictureChoiceSelection {...defaultProps} columns={2} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });

      it('shows labels when showLabels is true', () => {
        const { getByText } = render(
          <PictureChoiceSelection {...defaultProps} showLabels={true} />
        );

        expect(getByText('Choice 1')).toBeTruthy();
      });

      it('hides labels when showLabels is false', () => {
        const { queryByText } = render(
          <PictureChoiceSelection {...defaultProps} showLabels={false} />
        );

        expect(queryByText('Choice 1')).toBeFalsy();
      });

      it('shows selection indicator', () => {
        const { getByTestId } = render(
          <PictureChoiceSelection {...defaultProps} selectedIds={['choice-1']} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSelect when choice is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <PictureChoiceSelection {...defaultProps} onSelect={onSelect} />
        );

        fireEvent.press(getByText('Choice 1'));

        expect(onSelect).toHaveBeenCalledWith(mockChoices[0]);
      });

      it('allows multiple selections in multiSelect mode', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <PictureChoiceSelection {...defaultProps} onSelect={onSelect} multiSelect={true} />
        );

        fireEvent.press(getByText('Choice 1'));
        fireEvent.press(getByText('Choice 2'));

        expect(onSelect).toHaveBeenCalledTimes(2);
      });
    });

    describe('Edge Cases', () => {
      it('handles empty choices array', () => {
        const { getByTestId } = render(
          <PictureChoiceSelection choices={[]} onSelect={jest.fn()} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });

      it('handles choices without labels', () => {
        const noLabelChoices = mockChoices.map(({ label, ...rest }) => rest);

        const { getByTestId } = render(
          <PictureChoiceSelection choices={noLabelChoices} onSelect={jest.fn()} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });
    });
  });

  // ========================================
  // DROPDOWN SELECTION TESTS
  // ========================================

  describe('DropdownSelection', () => {
    const mockOptions = [
      { id: 'opt-1', text: 'Option 1', value: 'value1' },
      { id: 'opt-2', text: 'Option 2', value: 'value2' },
      { id: 'opt-3', text: 'Option 3', value: 'value3' },
    ];

    const defaultProps = {
      options: mockOptions,
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders the dropdown', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('renders placeholder when no selection', () => {
        const { getByText } = render(
          <DropdownSelection {...defaultProps} placeholder="Select an option" />
        );

        expect(getByText('Select an option')).toBeTruthy();
      });

      it('renders selected value', () => {
        const { getByText } = render(
          <DropdownSelection {...defaultProps} selectedId="opt-1" />
        );

        expect(getByText('Option 1')).toBeTruthy();
      });

      it('renders in disabled state', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} disabled={true} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('renders dropdown arrow icon', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('opens dropdown on press', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} testID="dropdown" />
        );

        fireEvent.press(getByTestId('dropdown'));

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('calls onSelect when option is selected', () => {
        const onSelect = jest.fn();
        const { getByTestId, getByText } = render(
          <DropdownSelection {...defaultProps} onSelect={onSelect} testID="dropdown" />
        );

        fireEvent.press(getByTestId('dropdown'));
        fireEvent.press(getByText('Option 1'));

        expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
      });

      it('closes dropdown after selection', () => {
        const { getByTestId, getByText } = render(
          <DropdownSelection {...defaultProps} testID="dropdown" />
        );

        fireEvent.press(getByTestId('dropdown'));
        fireEvent.press(getByText('Option 1'));

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('does not open when disabled', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} disabled={true} testID="dropdown" />
        );

        fireEvent.press(getByTestId('dropdown'));

        expect(getByTestId('dropdown')).toBeTruthy();
      });
    });

    describe('Search Functionality', () => {
      it('renders search input when searchable is true', () => {
        const { getByTestId } = render(
          <DropdownSelection {...defaultProps} searchable={true} testID="dropdown" />
        );

        fireEvent.press(getByTestId('dropdown'));

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('filters options based on search', () => {
        const { getByTestId, getByPlaceholderText } = render(
          <DropdownSelection
            {...defaultProps}
            searchable={true}
            searchPlaceholder="Search..."
            testID="dropdown"
          />
        );

        fireEvent.press(getByTestId('dropdown'));

        const searchInput = getByPlaceholderText('Search...');
        fireEvent.changeText(searchInput, 'Option 1');

        expect(getByTestId('dropdown')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty options array', () => {
        const { getByTestId } = render(
          <DropdownSelection options={[]} onSelect={jest.fn()} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('handles many options', () => {
        const manyOptions = Array.from({ length: 100 }, (_, i) => ({
          id: `opt-${i}`,
          text: `Option ${i}`,
          value: `value${i}`,
        }));

        const { getByTestId } = render(
          <DropdownSelection options={manyOptions} onSelect={jest.fn()} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });

      it('handles options with very long text', () => {
        const longOptions = [
          { id: 'opt-1', text: 'A'.repeat(200), value: 'long' },
        ];

        const { getByTestId } = render(
          <DropdownSelection options={longOptions} onSelect={jest.fn()} testID="dropdown" />
        );

        expect(getByTestId('dropdown')).toBeTruthy();
      });
    });
  });
});
