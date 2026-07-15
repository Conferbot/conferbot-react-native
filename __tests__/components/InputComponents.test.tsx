/**
 * InputComponents.test.tsx
 *
 * Tests for input components (TextInputField, TextInputComponent).
 *
 * Rewritten against the real component API: this module exports
 * TextInputField (reusable field) and TextInputComponent (full node component
 * taking NodeUIState.TextInput props plus onSubmit). Calendar/FileUpload/
 * Location/MultipleQuestions inputs live in AdvancedComponents, not here.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  TextInputField,
  TextInputComponent,
} from '../../src/components/NodeComponents/InputComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('InputComponents', () => {
  // ========================================
  // TEXT INPUT COMPONENT (full node component)
  // ========================================

  describe('TextInputComponent', () => {
    const defaultProps = {
      type: 'textInput' as const,
      nodeId: 'node-1',
      question: 'What is your name?',
      variableName: 'name',
      inputType: 'text' as const,
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the question', () => {
        const { getByText } = render(<TextInputComponent {...defaultProps} />);

        expect(getByText('What is your name?')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <TextInputComponent {...defaultProps} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('renders the placeholder', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} placeholder="Your name..." />
        );

        expect(getByPlaceholderText('Your name...')).toBeTruthy();
      });

      it('falls back to a type-based placeholder', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} inputType="email" />
        );

        expect(getByPlaceholderText('Enter email...')).toBeTruthy();
      });

      it('renders the send button', () => {
        const { getByText } = render(<TextInputComponent {...defaultProps} />);

        expect(getByText('Send')).toBeTruthy();
      });

      it('marks the send button disabled when the input is empty', () => {
        const { getByLabelText } = render(
          <TextInputComponent {...defaultProps} />
        );

        expect(
          getByLabelText('Submit').props.accessibilityState.disabled
        ).toBe(true);
      });
    });

    describe('Interactions', () => {
      it('submits the typed value', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            placeholder="Your name..."
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Your name...'), 'John Doe');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith({
          value: 'John Doe',
          variableName: 'name',
          type: 'text',
        });
      });

      it('trims whitespace from the submitted value', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            placeholder="Your name..."
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Your name...'), '  Jane  ');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 'Jane' })
        );
      });

      it('converts number input values to numbers', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            inputType="number"
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Enter number...'), '42');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 42, type: 'number' })
        );
      });
    });

    describe('Validation', () => {
      it('rejects an invalid email and shows an error', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            inputType="email"
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(
          getByPlaceholderText('Enter email...'),
          'not-an-email'
        );
        fireEvent.press(getByText('Send'));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(getByText('Please enter a valid email address')).toBeTruthy();
      });

      it('accepts a valid email', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            inputType="email"
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(
          getByPlaceholderText('Enter email...'),
          'john@example.com'
        );
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 'john@example.com' })
        );
      });

      it('enforces minLength validation', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            validation={{ minLength: 5 }}
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Enter text...'), 'abc');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(getByText('Minimum 5 characters required')).toBeTruthy();
      });

      it('enforces a custom pattern', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            validation={{ pattern: '^[A-Z]+$' }}
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Enter text...'), 'lower');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(getByText('Invalid format')).toBeTruthy();
      });

      it('rejects invalid numbers below the minimum', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent
            {...defaultProps}
            inputType="number"
            validation={{ min: 10 }}
            onSubmit={onSubmit}
          />
        );

        fireEvent.changeText(getByPlaceholderText('Enter number...'), '5');
        fireEvent.press(getByText('Send'));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(getByText('Minimum value is 10')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles very long input', () => {
        const onSubmit = jest.fn();
        const longText = 'x'.repeat(5000);
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.changeText(getByPlaceholderText('Enter text...'), longText);
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: longText })
        );
      });

      it('handles special characters', () => {
        const onSubmit = jest.fn();
        const special = '<script>alert("hi")</script> & "quotes"';
        const { getByPlaceholderText, getByText } = render(
          <TextInputComponent {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.changeText(getByPlaceholderText('Enter text...'), special);
        fireEvent.press(getByText('Send'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: special })
        );
      });
    });
  });

  // ========================================
  // TEXT INPUT FIELD (reusable field)
  // ========================================

  describe('TextInputField', () => {
    const defaultProps = {
      value: '',
      onChange: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders with the default placeholder', () => {
        const { getByPlaceholderText } = render(
          <TextInputField {...defaultProps} />
        );

        expect(getByPlaceholderText('Type your answer...')).toBeTruthy();
      });

      it('renders with a custom placeholder', () => {
        const { getByPlaceholderText } = render(
          <TextInputField {...defaultProps} placeholder="Email address" />
        );

        expect(getByPlaceholderText('Email address')).toBeTruthy();
      });

      it('renders with custom testID', () => {
        const { getByTestId } = render(
          <TextInputField {...defaultProps} testID="text-input-field" />
        );

        expect(getByTestId('text-input-field')).toBeTruthy();
      });

      it('displays the current value', () => {
        const { getByDisplayValue } = render(
          <TextInputField {...defaultProps} value="hello" />
        );

        expect(getByDisplayValue('hello')).toBeTruthy();
      });

      it('shows an external error message', () => {
        const { getByText } = render(
          <TextInputField {...defaultProps} errorMessage="Something is wrong" />
        );

        expect(getByText('Something is wrong')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onChange when text changes', () => {
        const onChange = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputField {...defaultProps} onChange={onChange} />
        );

        fireEvent.changeText(
          getByPlaceholderText('Type your answer...'),
          'typing'
        );

        expect(onChange).toHaveBeenCalledWith('typing');
      });

      it('calls onSubmit when a valid value is submitted via keyboard', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputField {...defaultProps} value="hello" onSubmit={onSubmit} />
        );

        fireEvent(
          getByPlaceholderText('Type your answer...'),
          'submitEditing'
        );

        expect(onSubmit).toHaveBeenCalled();
      });

      it('shows a validation error instead of submitting an invalid value', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <TextInputField
            {...defaultProps}
            value="bad-email"
            inputType="email"
            onSubmit={onSubmit}
          />
        );

        fireEvent(
          getByPlaceholderText('Type your answer...'),
          'submitEditing'
        );

        expect(onSubmit).not.toHaveBeenCalled();
        expect(getByText('Please enter a valid email address')).toBeTruthy();
      });

      it('is not editable when disabled', () => {
        const { getByPlaceholderText } = render(
          <TextInputField {...defaultProps} disabled={true} />
        );

        expect(
          getByPlaceholderText('Type your answer...').props.editable
        ).toBe(false);
      });
    });
  });
});
