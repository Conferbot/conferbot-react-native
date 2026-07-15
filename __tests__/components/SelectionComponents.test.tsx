/**
 * SelectionComponents.test.tsx
 *
 * Tests for selection components (ButtonGroup, CardGrid, CarouselView,
 * PictureChoiceGrid, DropdownPicker).
 *
 * Rewritten against the real component API: these components take NodeUIState
 * props plus an onSubmit callback, as wired by NodeRenderer. The previous
 * tests imported ButtonsSelection/CardsSelection/... which never existed.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import {
  ButtonGroup,
  CardGrid,
  CarouselView,
  PictureChoiceGrid,
  DropdownPicker,
} from '../../src/components/NodeComponents/SelectionComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('SelectionComponents', () => {
  // ========================================
  // BUTTON GROUP TESTS
  // ========================================

  describe('ButtonGroup', () => {
    const defaultProps = {
      type: 'buttons' as const,
      nodeId: 'node-1',
      question: 'Pick an option',
      buttons: [
        { id: 'b1', label: 'Option 1' },
        { id: 'b2', label: 'Option 2', value: 'two' },
        { id: 'b3', label: 'Option 3' },
      ],
      variableName: 'choice',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders all button options', () => {
        const { getByText } = render(<ButtonGroup {...defaultProps} />);

        expect(getByText('Option 1')).toBeTruthy();
        expect(getByText('Option 2')).toBeTruthy();
        expect(getByText('Option 3')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <ButtonGroup {...defaultProps} testID="buttons-selection" />
        );

        expect(getByTestId('buttons-selection')).toBeTruthy();
      });

      it('renders button icons when provided', () => {
        const { getByText } = render(
          <ButtonGroup
            {...defaultProps}
            buttons={[{ id: 'b1', label: 'Home', icon: '🏠' }]}
          />
        );

        expect(getByText('🏠')).toBeTruthy();
      });

      it('renders a submit button in multi-select mode', () => {
        const { getByText } = render(
          <ButtonGroup {...defaultProps} multiSelect={true} />
        );

        expect(getByText('Submit (0)')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('submits immediately on press in single-select mode', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Option 2'));

        expect(onSubmit).toHaveBeenCalledWith({
          buttonId: 'b2',
          value: 'two',
          label: 'Option 2',
          variableName: 'choice',
        });
      });

      it('uses the label as value when no value is set', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Option 1'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 'Option 1' })
        );
      });

      it('ignores further presses after a single-select submission', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Option 1'));
        fireEvent.press(getByText('Option 2'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('collects multiple selections and submits them together', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} multiSelect={true} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Option 1'));
        fireEvent.press(getByText('Option 3'));
        fireEvent.press(getByText('Submit (2)'));

        expect(onSubmit).toHaveBeenCalledWith({
          buttonIds: ['b1', 'b3'],
          values: ['Option 1', 'Option 3'],
          labels: ['Option 1', 'Option 3'],
          variableName: 'choice',
        });
      });

      it('toggles a selection off in multi-select mode', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} multiSelect={true} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Option 1'));
        fireEvent.press(getByText('Option 1'));

        expect(getByText('Submit (0)')).toBeTruthy();
      });

      it('does not submit in multi-select mode with nothing selected', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <ButtonGroup {...defaultProps} multiSelect={true} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Submit (0)'));

        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('handles an empty buttons array', () => {
        const { getByTestId } = render(
          <ButtonGroup {...defaultProps} buttons={[]} testID="buttons-selection" />
        );

        expect(getByTestId('buttons-selection')).toBeTruthy();
      });

      it('handles very long labels', () => {
        const longLabel = 'A'.repeat(300);
        const { getByText } = render(
          <ButtonGroup
            {...defaultProps}
            buttons={[{ id: 'b1', label: longLabel }]}
          />
        );

        expect(getByText(longLabel)).toBeTruthy();
      });
    });
  });

  // ========================================
  // CARD GRID TESTS
  // ========================================

  describe('CardGrid', () => {
    const defaultProps = {
      type: 'cards' as const,
      nodeId: 'node-2',
      question: 'Choose a plan',
      cards: [
        {
          id: 'c1',
          title: 'Starter',
          description: 'For individuals',
          buttons: [{ id: 'cb1', label: 'Choose Starter' }],
        },
        {
          id: 'c2',
          title: 'Pro',
          description: 'For teams',
          imageUrl: 'https://example.com/pro.png',
          buttons: [{ id: 'cb2', label: 'Choose Pro', value: 'pro' }],
        },
      ],
      variableName: 'plan',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders all card titles', () => {
        const { getByText } = render(<CardGrid {...defaultProps} />);

        expect(getByText('Starter')).toBeTruthy();
        expect(getByText('Pro')).toBeTruthy();
      });

      it('renders card descriptions', () => {
        const { getByText } = render(<CardGrid {...defaultProps} />);

        expect(getByText('For individuals')).toBeTruthy();
        expect(getByText('For teams')).toBeTruthy();
      });

      it('renders the question when provided', () => {
        const { getByText } = render(<CardGrid {...defaultProps} />);

        expect(getByText('Choose a plan')).toBeTruthy();
      });

      it('renders card buttons', () => {
        const { getByText } = render(<CardGrid {...defaultProps} />);

        expect(getByText('Choose Starter')).toBeTruthy();
        expect(getByText('Choose Pro')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <CardGrid {...defaultProps} testID="cards-selection" />
        );

        expect(getByTestId('cards-selection')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('submits when a card button is pressed', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <CardGrid {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Choose Pro'));

        expect(onSubmit).toHaveBeenCalledWith({
          cardId: 'c2',
          buttonId: 'cb2',
          value: 'pro',
          label: 'Choose Pro',
          variableName: 'plan',
        });
      });

      it('opens URL buttons via Linking instead of submitting', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <CardGrid
            {...defaultProps}
            cards={[
              {
                id: 'c1',
                title: 'Docs',
                buttons: [
                  { id: 'cb1', label: 'Open Docs', url: 'https://docs.example.com' },
                ],
              },
            ]}
            onSubmit={onSubmit}
          />
        );

        fireEvent.press(getByText('Open Docs'));

        expect(Linking.openURL).toHaveBeenCalledWith('https://docs.example.com');
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('ignores further presses after submission', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <CardGrid {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Choose Starter'));
        fireEvent.press(getByText('Choose Pro'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edge Cases', () => {
      it('handles an empty cards array', () => {
        const { getByTestId } = render(
          <CardGrid {...defaultProps} cards={[]} testID="cards-selection" />
        );

        expect(getByTestId('cards-selection')).toBeTruthy();
      });

      it('handles cards without buttons', () => {
        const { getByText } = render(
          <CardGrid
            {...defaultProps}
            cards={[{ id: 'c1', title: 'Info only' }]}
          />
        );

        expect(getByText('Info only')).toBeTruthy();
      });
    });
  });

  // ========================================
  // CAROUSEL VIEW TESTS
  // ========================================

  describe('CarouselView', () => {
    const defaultProps = {
      type: 'carousel' as const,
      nodeId: 'node-3',
      cards: [
        { id: 'c1', title: 'Slide 1' },
        { id: 'c2', title: 'Slide 2' },
      ],
      variableName: 'slide',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders the carousel container', () => {
      const { getByTestId } = render(
        <CarouselView {...defaultProps} testID="carousel-selection" />
      );

      expect(getByTestId('carousel-selection')).toBeTruthy();
    });

    it('exposes an accessible card list', () => {
      const { getByLabelText } = render(<CarouselView {...defaultProps} />);

      expect(getByLabelText('Card carousel')).toBeTruthy();
    });

    it('passes all cards to the list', () => {
      const { getByLabelText } = render(<CarouselView {...defaultProps} />);

      const list = getByLabelText('Card carousel');
      expect(list.props.data).toHaveLength(2);
    });

    it('handles an empty cards array', () => {
      const { getByLabelText } = render(
        <CarouselView {...defaultProps} cards={[]} />
      );

      expect(getByLabelText('Card carousel').props.data).toHaveLength(0);
    });
  });

  // ========================================
  // PICTURE CHOICE GRID TESTS
  // ========================================

  describe('PictureChoiceGrid', () => {
    const defaultProps = {
      type: 'pictureChoice' as const,
      nodeId: 'node-4',
      question: 'Pick a picture',
      choices: [
        { id: 'p1', imageUrl: 'https://example.com/1.png', label: 'Cat' },
        { id: 'p2', imageUrl: 'https://example.com/2.png', label: 'Dog', value: 'dog' },
      ],
      variableName: 'animal',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the question', () => {
        const { getByText } = render(<PictureChoiceGrid {...defaultProps} />);

        expect(getByText('Pick a picture')).toBeTruthy();
      });

      it('renders all choice labels', () => {
        const { getByText } = render(<PictureChoiceGrid {...defaultProps} />);

        expect(getByText('Cat')).toBeTruthy();
        expect(getByText('Dog')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <PictureChoiceGrid {...defaultProps} testID="picture-choice" />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('submits immediately on press in single-select mode', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <PictureChoiceGrid {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Dog'));

        expect(onSubmit).toHaveBeenCalledWith({
          choiceId: 'p2',
          value: 'dog',
          label: 'Dog',
          variableName: 'animal',
        });
      });

      it('collects selections in multi-select mode and submits together', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <PictureChoiceGrid
            {...defaultProps}
            multiSelect={true}
            onSubmit={onSubmit}
          />
        );

        fireEvent.press(getByText('Cat'));
        fireEvent.press(getByText('Dog'));
        fireEvent.press(getByText('Submit (2)'));

        expect(onSubmit).toHaveBeenCalledWith({
          choiceIds: ['p1', 'p2'],
          values: ['Cat', 'dog'],
          labels: ['Cat', 'Dog'],
          variableName: 'animal',
        });
      });

      it('ignores further presses after submission', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <PictureChoiceGrid {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Cat'));
        fireEvent.press(getByText('Dog'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edge Cases', () => {
      it('handles an empty choices array', () => {
        const { getByTestId } = render(
          <PictureChoiceGrid
            {...defaultProps}
            choices={[]}
            testID="picture-choice"
          />
        );

        expect(getByTestId('picture-choice')).toBeTruthy();
      });
    });
  });

  // ========================================
  // DROPDOWN PICKER TESTS
  // ========================================

  describe('DropdownPicker', () => {
    const defaultProps = {
      type: 'dropdown' as const,
      nodeId: 'node-5',
      question: 'Select a country',
      options: [
        { id: 'o1', label: 'Argentina' },
        { id: 'o2', label: 'Brazil', value: 'BR' },
        { id: 'o3', label: 'Canada' },
      ],
      variableName: 'country',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the question', () => {
        const { getAllByText } = render(<DropdownPicker {...defaultProps} />);

        // Question appears on the container and inside the modal header
        expect(getAllByText('Select a country').length).toBeGreaterThan(0);
      });

      it('renders the placeholder when nothing is selected', () => {
        const { getByText } = render(
          <DropdownPicker {...defaultProps} placeholder="Pick one..." />
        );

        expect(getByText('Pick one...')).toBeTruthy();
      });

      it('renders all options', () => {
        const { getByText } = render(<DropdownPicker {...defaultProps} />);

        expect(getByText('Argentina')).toBeTruthy();
        expect(getByText('Brazil')).toBeTruthy();
        expect(getByText('Canada')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <DropdownPicker {...defaultProps} testID="dropdown-selection" />
        );

        expect(getByTestId('dropdown-selection')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('submits the pressed option in single-select mode', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <DropdownPicker {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Brazil'));

        expect(onSubmit).toHaveBeenCalledWith({
          optionId: 'o2',
          value: 'BR',
          label: 'Brazil',
          variableName: 'country',
        });
      });

      it('collects selections in multi-select mode and submits with Done', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <DropdownPicker {...defaultProps} multiSelect={true} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Argentina'));
        fireEvent.press(getByText('Canada'));
        fireEvent.press(getByText('Done (2)'));

        expect(onSubmit).toHaveBeenCalledWith({
          optionIds: ['o1', 'o3'],
          values: ['Argentina', 'Canada'],
          labels: ['Argentina', 'Canada'],
          variableName: 'country',
        });
      });

      it('ignores further presses after submission', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <DropdownPicker {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Argentina'));
        fireEvent.press(getByText('Brazil'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe('Search Functionality', () => {
      it('filters options by search text', () => {
        const { getByPlaceholderText, queryByText } = render(
          <DropdownPicker {...defaultProps} searchable={true} />
        );

        fireEvent.changeText(getByPlaceholderText('Search...'), 'bra');

        expect(queryByText('Brazil')).toBeTruthy();
        expect(queryByText('Canada')).toBeNull();
      });

      it('shows all options when search is cleared', () => {
        const { getByPlaceholderText, queryByText } = render(
          <DropdownPicker {...defaultProps} searchable={true} />
        );

        const search = getByPlaceholderText('Search...');
        fireEvent.changeText(search, 'bra');
        fireEvent.changeText(search, '');

        expect(queryByText('Argentina')).toBeTruthy();
        expect(queryByText('Canada')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles an empty options array', () => {
        const { getByTestId } = render(
          <DropdownPicker
            {...defaultProps}
            options={[]}
            testID="dropdown-selection"
          />
        );

        expect(getByTestId('dropdown-selection')).toBeTruthy();
      });
    });
  });
});
