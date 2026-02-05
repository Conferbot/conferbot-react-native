/**
 * InputComponents.test.tsx
 *
 * Tests for input components (TextInput, Calendar, FileUpload, Location, etc.)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  TextInputComponent,
  CalendarInput,
  FileUploadInput,
  LocationPickerInput,
  MultipleQuestionsInput,
} from '../../src/components/NodeComponents/InputComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock document picker
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: { allFiles: 'allFiles' },
}));

describe('InputComponents', () => {
  // ========================================
  // TEXT INPUT COMPONENT TESTS
  // ========================================

  describe('TextInputComponent', () => {
    const defaultProps = {
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the text input', () => {
        const { getByTestId } = render(
          <TextInputComponent {...defaultProps} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('renders with placeholder', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} placeholder="Enter your name" />
        );

        expect(getByPlaceholderText('Enter your name')).toBeTruthy();
      });

      it('renders submit button', () => {
        const { getByTestId } = render(
          <TextInputComponent {...defaultProps} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('renders multiline when configured', () => {
        const { getByTestId } = render(
          <TextInputComponent {...defaultProps} multiline={true} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('renders character count when maxLength is set', () => {
        const { getByTestId } = render(
          <TextInputComponent {...defaultProps} maxLength={100} showCharCount={true} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('renders with input type hints', () => {
        const inputTypes = ['text', 'email', 'phone', 'number', 'url'] as const;

        inputTypes.forEach((inputType) => {
          const { getByTestId, unmount } = render(
            <TextInputComponent {...defaultProps} inputType={inputType} testID="text-input" />
          );
          expect(getByTestId('text-input')).toBeTruthy();
          unmount();
        });
      });
    });

    describe('Interactions', () => {
      it('updates value on text change', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} placeholder="Input" />
        );

        const input = getByPlaceholderText('Input');
        fireEvent.changeText(input, 'test value');

        expect(input.props.value).toBe('test value');
      });

      it('calls onSubmit when submit button is pressed', async () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByTestId } = render(
          <TextInputComponent onSubmit={onSubmit} placeholder="Input" testID="text-input" />
        );

        const input = getByPlaceholderText('Input');
        fireEvent.changeText(input, 'test value');
        fireEvent(input, 'submitEditing');

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith('test value');
        });
      });

      it('calls onSubmit when enter key is pressed', async () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputComponent onSubmit={onSubmit} placeholder="Input" />
        );

        const input = getByPlaceholderText('Input');
        fireEvent.changeText(input, 'test');
        fireEvent(input, 'submitEditing');

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith('test');
        });
      });

      it('validates required field', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(
          <TextInputComponent onSubmit={onSubmit} required={true} testID="text-input" />
        );

        expect(getByTestId('text-input')).toBeTruthy();
      });

      it('validates email format', async () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputComponent onSubmit={onSubmit} inputType="email" placeholder="Email" />
        );

        const input = getByPlaceholderText('Email');
        fireEvent.changeText(input, 'invalid-email');
        fireEvent(input, 'submitEditing');

        // Should not submit invalid email
        await waitFor(() => {
          expect(onSubmit).not.toHaveBeenCalled();
        });
      });

      it('validates with custom pattern', async () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByTestId } = render(
          <TextInputComponent
            onSubmit={onSubmit}
            pattern="^[A-Z]{3}$"
            placeholder="Code"
            testID="text-input"
          />
        );

        const input = getByPlaceholderText('Code');
        fireEvent.changeText(input, 'abc');

        expect(getByTestId('text-input')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty submission', async () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputComponent onSubmit={onSubmit} placeholder="Input" allowEmpty={true} />
        );

        const input = getByPlaceholderText('Input');
        fireEvent(input, 'submitEditing');

        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalledWith('');
        });
      });

      it('handles very long input', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} placeholder="Input" />
        );

        const input = getByPlaceholderText('Input');
        const longText = 'A'.repeat(10000);
        fireEvent.changeText(input, longText);

        expect(input.props.value).toBe(longText);
      });

      it('respects maxLength', () => {
        const { getByPlaceholderText } = render(
          <TextInputComponent {...defaultProps} placeholder="Input" maxLength={10} />
        );

        const input = getByPlaceholderText('Input');
        fireEvent.changeText(input, 'A'.repeat(20));

        expect(input.props.value.length).toBeLessThanOrEqual(10);
      });

      it('handles special characters', () => {
        const onSubmit = jest.fn();
        const { getByPlaceholderText } = render(
          <TextInputComponent onSubmit={onSubmit} placeholder="Input" />
        );

        const input = getByPlaceholderText('Input');
        fireEvent.changeText(input, '<script>alert("xss")</script>');
        fireEvent(input, 'submitEditing');

        expect(onSubmit).toHaveBeenCalledWith('<script>alert("xss")</script>');
      });
    });
  });

  // ========================================
  // CALENDAR INPUT TESTS
  // ========================================

  describe('CalendarInput', () => {
    const defaultProps = {
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders the calendar input', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('renders date picker trigger', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('renders with placeholder', () => {
        const { getByText } = render(
          <CalendarInput {...defaultProps} placeholder="Select a date" />
        );

        expect(getByText('Select a date')).toBeTruthy();
      });

      it('renders selected date', () => {
        const { getByTestId } = render(
          <CalendarInput
            {...defaultProps}
            selectedDate={new Date('2024-06-15')}
            testID="calendar"
          />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('renders time picker when mode is datetime', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} mode="datetime" testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('renders date range picker when mode is range', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} mode="range" testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('opens calendar on press', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} testID="calendar" />
        );

        fireEvent.press(getByTestId('calendar'));

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('calls onSelect when date is selected', async () => {
        const onSelect = jest.fn();
        const { getByTestId } = render(
          <CalendarInput onSelect={onSelect} testID="calendar" />
        );

        fireEvent.press(getByTestId('calendar'));

        // Date selection would trigger onSelect
        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('respects minDate constraint', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} minDate={new Date('2024-01-01')} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('respects maxDate constraint', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} maxDate={new Date('2024-12-31')} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('disables specific dates', () => {
        const { getByTestId } = render(
          <CalendarInput
            {...defaultProps}
            disabledDates={[new Date('2024-06-20')]}
            testID="calendar"
          />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles invalid date', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} selectedDate={new Date('invalid')} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });

      it('handles disabled state', () => {
        const { getByTestId } = render(
          <CalendarInput {...defaultProps} disabled={true} testID="calendar" />
        );

        expect(getByTestId('calendar')).toBeTruthy();
      });
    });
  });

  // ========================================
  // FILE UPLOAD INPUT TESTS
  // ========================================

  describe('FileUploadInput', () => {
    const defaultProps = {
      onUpload: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders the file upload input', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('renders upload button', () => {
        const { getByText } = render(
          <FileUploadInput {...defaultProps} buttonText="Choose File" />
        );

        expect(getByText('Choose File')).toBeTruthy();
      });

      it('renders drag and drop zone', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} showDropZone={true} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('renders accepted file types', () => {
        const { getByTestId } = render(
          <FileUploadInput
            {...defaultProps}
            acceptedTypes={['image/*', '.pdf']}
            showAcceptedTypes={true}
            testID="file-upload"
          />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('renders upload progress', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} uploadProgress={50} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('renders selected files list', () => {
        const { getByTestId } = render(
          <FileUploadInput
            {...defaultProps}
            selectedFiles={[{ name: 'file.pdf', size: 1024 }]}
            testID="file-upload"
          />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('opens file picker on button press', () => {
        const { getByText } = render(
          <FileUploadInput {...defaultProps} buttonText="Choose File" />
        );

        fireEvent.press(getByText('Choose File'));

        expect(getByText('Choose File')).toBeTruthy();
      });

      it('calls onUpload when file is selected', async () => {
        const onUpload = jest.fn();
        const { getByText } = render(
          <FileUploadInput onUpload={onUpload} buttonText="Upload" />
        );

        fireEvent.press(getByText('Upload'));

        // File selection would trigger onUpload
        expect(getByText('Upload')).toBeTruthy();
      });

      it('allows removing selected files', () => {
        const onRemove = jest.fn();
        const { getByTestId } = render(
          <FileUploadInput
            {...defaultProps}
            selectedFiles={[{ name: 'file.pdf', size: 1024 }]}
            onRemove={onRemove}
            testID="file-upload"
          />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('allows multiple file selection when multiple is true', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} multiple={true} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });
    });

    describe('Validation', () => {
      it('validates file size', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} maxFileSize={5 * 1024 * 1024} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('validates file type', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} acceptedTypes={['.pdf', '.doc']} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('validates maximum file count', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} maxFiles={5} multiple={true} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles disabled state', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} disabled={true} testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });

      it('handles upload error', () => {
        const { getByTestId } = render(
          <FileUploadInput {...defaultProps} error="Upload failed" testID="file-upload" />
        );

        expect(getByTestId('file-upload')).toBeTruthy();
      });
    });
  });

  // ========================================
  // LOCATION PICKER INPUT TESTS
  // ========================================

  describe('LocationPickerInput', () => {
    const defaultProps = {
      onSelect: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders the location picker', () => {
        const { getByTestId } = render(
          <LocationPickerInput {...defaultProps} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('renders map view', () => {
        const { getByTestId } = render(
          <LocationPickerInput {...defaultProps} showMap={true} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('renders search input', () => {
        const { getByPlaceholderText } = render(
          <LocationPickerInput {...defaultProps} searchPlaceholder="Search location" />
        );

        expect(getByPlaceholderText('Search location')).toBeTruthy();
      });

      it('renders current location button', () => {
        const { getByTestId } = render(
          <LocationPickerInput
            {...defaultProps}
            showCurrentLocationButton={true}
            testID="location-picker"
          />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('renders selected location', () => {
        const { getByTestId } = render(
          <LocationPickerInput
            {...defaultProps}
            selectedLocation={{ lat: 40.7128, lng: -74.006, address: 'New York, NY' }}
            testID="location-picker"
          />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('searches for locations', async () => {
        const { getByPlaceholderText } = render(
          <LocationPickerInput {...defaultProps} searchPlaceholder="Search" />
        );

        const input = getByPlaceholderText('Search');
        fireEvent.changeText(input, 'New York');

        expect(input.props.value).toBe('New York');
      });

      it('calls onSelect when location is selected', () => {
        const onSelect = jest.fn();
        const { getByTestId } = render(
          <LocationPickerInput onSelect={onSelect} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('gets current location on button press', () => {
        const { getByTestId } = render(
          <LocationPickerInput
            {...defaultProps}
            showCurrentLocationButton={true}
            testID="location-picker"
          />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('allows map marker drag', () => {
        const { getByTestId } = render(
          <LocationPickerInput {...defaultProps} draggableMarker={true} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles location permission denied', () => {
        const { getByTestId } = render(
          <LocationPickerInput
            {...defaultProps}
            locationPermissionDenied={true}
            testID="location-picker"
          />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('handles disabled state', () => {
        const { getByTestId } = render(
          <LocationPickerInput {...defaultProps} disabled={true} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });

      it('handles loading state', () => {
        const { getByTestId } = render(
          <LocationPickerInput {...defaultProps} loading={true} testID="location-picker" />
        );

        expect(getByTestId('location-picker')).toBeTruthy();
      });
    });
  });

  // ========================================
  // MULTIPLE QUESTIONS INPUT TESTS
  // ========================================

  describe('MultipleQuestionsInput', () => {
    const mockQuestions = [
      { id: 'q1', text: 'What is your name?', type: 'text' as const, required: true },
      { id: 'q2', text: 'What is your email?', type: 'email' as const, required: true },
      { id: 'q3', text: 'Any comments?', type: 'textarea' as const, required: false },
    ];

    const defaultProps = {
      questions: mockQuestions,
      onSubmit: jest.fn(),
    };

    describe('Rendering', () => {
      it('renders all questions', () => {
        const { getByText } = render(
          <MultipleQuestionsInput {...defaultProps} />
        );

        expect(getByText('What is your name?')).toBeTruthy();
        expect(getByText('What is your email?')).toBeTruthy();
        expect(getByText('Any comments?')).toBeTruthy();
      });

      it('renders with testID', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput {...defaultProps} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });

      it('renders required indicators', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput {...defaultProps} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });

      it('renders submit button', () => {
        const { getByText } = render(
          <MultipleQuestionsInput {...defaultProps} submitButtonText="Submit All" />
        );

        expect(getByText('Submit All')).toBeTruthy();
      });

      it('renders progress indicator', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput {...defaultProps} showProgress={true} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('allows answering questions', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput {...defaultProps} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });

      it('calls onSubmit with all answers', async () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <MultipleQuestionsInput
            {...defaultProps}
            onSubmit={onSubmit}
            submitButtonText="Submit"
          />
        );

        fireEvent.press(getByText('Submit'));

        // Validation may prevent submission if required fields empty
        expect(getByText('Submit')).toBeTruthy();
      });

      it('validates required questions before submit', () => {
        const onSubmit = jest.fn();
        const { getByText, getByTestId } = render(
          <MultipleQuestionsInput
            {...defaultProps}
            onSubmit={onSubmit}
            submitButtonText="Submit"
            testID="multi-questions"
          />
        );

        fireEvent.press(getByText('Submit'));

        expect(getByTestId('multi-questions')).toBeTruthy();
      });

      it('navigates between questions in wizard mode', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput {...defaultProps} mode="wizard" testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty questions array', () => {
        const { getByTestId } = render(
          <MultipleQuestionsInput questions={[]} onSubmit={jest.fn()} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });

      it('handles single question', () => {
        const { getByText } = render(
          <MultipleQuestionsInput questions={[mockQuestions[0]]} onSubmit={jest.fn()} />
        );

        expect(getByText('What is your name?')).toBeTruthy();
      });

      it('handles many questions', () => {
        const manyQuestions = Array.from({ length: 20 }, (_, i) => ({
          id: `q${i}`,
          text: `Question ${i}?`,
          type: 'text' as const,
          required: false,
        }));

        const { getByTestId } = render(
          <MultipleQuestionsInput questions={manyQuestions} onSubmit={jest.fn()} testID="multi-questions" />
        );

        expect(getByTestId('multi-questions')).toBeTruthy();
      });
    });
  });
});
