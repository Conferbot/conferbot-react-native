/**
 * PreChatForm.test.tsx
 *
 * Tests for the PreChatForm component that collects user info before handover.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PreChatForm } from '../../src/components/Handover/PreChatForm';
import { createMockTheme } from '../testUtils';
import type { PreChatFormConfig } from '../../src/components/Handover/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('PreChatForm', () => {
  const defaultConfig: PreChatFormConfig = {
    enabled: true,
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: 'Phone', type: 'phone', required: false },
      { id: 'message', label: 'How can we help?', type: 'textarea', required: false },
    ],
  };

  const defaultProps = {
    config: defaultConfig,
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the form', () => {
      const { getByTestId } = render(
        <PreChatForm {...defaultProps} testID="pre-chat-form" />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('renders all configured fields', () => {
      const { getByText } = render(
        <PreChatForm {...defaultProps} />
      );

      expect(getByText('Name')).toBeTruthy();
      expect(getByText('Email')).toBeTruthy();
      expect(getByText('Phone')).toBeTruthy();
      expect(getByText('How can we help?')).toBeTruthy();
    });

    it('renders submit button', () => {
      const { getByText } = render(
        <PreChatForm {...defaultProps} submitButtonText="Start Chat" />
      );

      expect(getByText('Start Chat')).toBeTruthy();
    });

    it('renders form title when provided', () => {
      const { getByText } = render(
        <PreChatForm {...defaultProps} title="Contact Information" />
      );

      expect(getByText('Contact Information')).toBeTruthy();
    });

    it('renders form description when provided', () => {
      const { getByText } = render(
        <PreChatForm
          {...defaultProps}
          description="Please fill out the form below to connect with an agent"
        />
      );

      expect(getByText('Please fill out the form below to connect with an agent')).toBeTruthy();
    });

    it('shows required indicator for required fields', () => {
      const { getByTestId } = render(
        <PreChatForm {...defaultProps} testID="pre-chat-form" />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('renders different input types correctly', () => {
      const { getByTestId } = render(
        <PreChatForm {...defaultProps} testID="pre-chat-form" />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('renders cancel button when onCancel is provided', () => {
      const { getByText } = render(
        <PreChatForm {...defaultProps} onCancel={jest.fn()} cancelButtonText="Cancel" />
      );

      expect(getByText('Cancel')).toBeTruthy();
    });
  });

  // ========================================
  // INPUT INTERACTION TESTS
  // ========================================

  describe('Input Interactions', () => {
    it('allows text input in text fields', () => {
      const { getByPlaceholderText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            ...defaultConfig,
            fields: [{ id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter name' }],
          }}
        />
      );

      const input = getByPlaceholderText('Enter name');
      fireEvent.changeText(input, 'John Doe');

      expect(input.props.value).toBe('John Doe');
    });

    it('allows text input in email fields', () => {
      const { getByPlaceholderText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            ...defaultConfig,
            fields: [{ id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter email' }],
          }}
        />
      );

      const input = getByPlaceholderText('Enter email');
      fireEvent.changeText(input, 'john@example.com');

      expect(input.props.value).toBe('john@example.com');
    });

    it('allows text input in phone fields', () => {
      const { getByPlaceholderText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            ...defaultConfig,
            fields: [{ id: 'phone', label: 'Phone', type: 'phone', required: false, placeholder: 'Enter phone' }],
          }}
        />
      );

      const input = getByPlaceholderText('Enter phone');
      fireEvent.changeText(input, '+1234567890');

      expect(input.props.value).toBe('+1234567890');
    });

    it('allows multiline input in textarea fields', () => {
      const { getByPlaceholderText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            ...defaultConfig,
            fields: [{ id: 'message', label: 'Message', type: 'textarea', required: false, placeholder: 'Enter message' }],
          }}
        />
      );

      const input = getByPlaceholderText('Enter message');
      fireEvent.changeText(input, 'Line 1\nLine 2');

      expect(input.props.value).toBe('Line 1\nLine 2');
    });
  });

  // ========================================
  // FORM SUBMISSION TESTS
  // ========================================

  describe('Form Submission', () => {
    it('calls onSubmit with form data when submitted', async () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PreChatForm
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
          config={{
            ...defaultConfig,
            fields: [
              { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Name' },
              { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Email' },
            ],
          }}
        />
      );

      fireEvent.changeText(getByPlaceholderText('Name'), 'John Doe');
      fireEvent.changeText(getByPlaceholderText('Email'), 'john@example.com');
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
        });
      });
    });

    it('does not submit when required fields are empty', async () => {
      const onSubmit = jest.fn();
      const { getByText } = render(
        <PreChatForm
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
        />
      );

      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    it('shows validation errors for required fields', async () => {
      const { getByText, getByTestId } = render(
        <PreChatForm
          {...defaultProps}
          submitButtonText="Submit"
          testID="pre-chat-form"
        />
      );

      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(getByTestId('pre-chat-form')).toBeTruthy();
      });
    });

    it('validates email format', async () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PreChatForm
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
          config={{
            ...defaultConfig,
            fields: [
              { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Email' },
            ],
          }}
        />
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    it('allows submission with valid email format', async () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PreChatForm
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
          config={{
            ...defaultConfig,
            fields: [
              { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Email' },
            ],
          }}
        />
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'valid@example.com');
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ email: 'valid@example.com' });
      });
    });
  });

  // ========================================
  // CANCEL FUNCTIONALITY TESTS
  // ========================================

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button is pressed', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <PreChatForm {...defaultProps} onCancel={onCancel} cancelButtonText="Cancel" />
      );

      fireEvent.press(getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible form container', () => {
      const { getByTestId } = render(
        <PreChatForm {...defaultProps} testID="pre-chat-form" />
      );

      const container = getByTestId('pre-chat-form');
      expect(container).toBeTruthy();
    });

    it('input fields have accessibility labels', () => {
      const { getByLabelText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            ...defaultConfig,
            fields: [
              { id: 'name', label: 'Name', type: 'text', required: true },
            ],
          }}
        />
      );

      expect(getByLabelText('Name')).toBeTruthy();
    });

    it('supports custom accessibility label for form', () => {
      const { getByTestId } = render(
        <PreChatForm
          {...defaultProps}
          testID="pre-chat-form"
          accessibilityLabel="Pre-chat information form"
        />
      );

      const container = getByTestId('pre-chat-form');
      expect(container.props.accessibilityLabel).toBe('Pre-chat information form');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty fields array', () => {
      const { getByTestId } = render(
        <PreChatForm
          {...defaultProps}
          config={{ enabled: true, fields: [] }}
          testID="pre-chat-form"
        />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('handles single field', () => {
      const { getByText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            enabled: true,
            fields: [{ id: 'name', label: 'Name', type: 'text', required: true }],
          }}
        />
      );

      expect(getByText('Name')).toBeTruthy();
    });

    it('handles many fields', () => {
      const manyFields = Array.from({ length: 10 }, (_, i) => ({
        id: `field-${i}`,
        label: `Field ${i}`,
        type: 'text' as const,
        required: false,
      }));

      const { getByTestId } = render(
        <PreChatForm
          {...defaultProps}
          config={{ enabled: true, fields: manyFields }}
          testID="pre-chat-form"
        />
      );

      expect(getByTestId('pre-chat-form')).toBeTruthy();
    });

    it('handles special characters in input', () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PreChatForm
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
          config={{
            enabled: true,
            fields: [
              { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Name' },
            ],
          }}
        />
      );

      fireEvent.changeText(getByPlaceholderText('Name'), '<script>alert("xss")</script>');
      fireEvent.press(getByText('Submit'));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('handles very long input values', () => {
      const { getByPlaceholderText } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            enabled: true,
            fields: [
              { id: 'message', label: 'Message', type: 'textarea', required: false, placeholder: 'Message' },
            ],
          }}
        />
      );

      const longText = 'A'.repeat(5000);
      const input = getByPlaceholderText('Message');
      fireEvent.changeText(input, longText);

      expect(input.props.value).toBe(longText);
    });

    it('handles field with default value', () => {
      const { getByDisplayValue } = render(
        <PreChatForm
          {...defaultProps}
          config={{
            enabled: true,
            fields: [
              { id: 'name', label: 'Name', type: 'text', required: true, defaultValue: 'Default Name' },
            ],
          }}
        />
      );

      expect(getByDisplayValue('Default Name')).toBeTruthy();
    });
  });
});
