// @ts-nocheck
/**
 * InputComponents.tsx
 *
 * Components for text input and form fields.
 * Supports various input types: text, email, phone, number, url, date, address.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
  Dimensions,
  Animated,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;

// ========================================
// TYPES
// ========================================

type InputType = NodeUIState.TextInput['inputType'];

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

interface TextInputComponentProps extends NodeUIState.TextInput {
  onSubmit: (response: any, portName?: string) => void;
}

interface TextInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputType?: InputType;
  validation?: NodeUIState.TextInput['validation'];
  errorMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get keyboard type based on input type
 */
const getKeyboardType = (inputType: InputType): KeyboardTypeOptions => {
  switch (inputType) {
    case 'email':
      return 'email-address';
    case 'phone':
      return 'phone-pad';
    case 'number':
      return 'numeric';
    case 'url':
      return 'url';
    default:
      return 'default';
  }
};

/**
 * Get return key type based on input type
 */
const getReturnKeyType = (inputType: InputType): ReturnKeyTypeOptions => {
  switch (inputType) {
    case 'text':
    case 'address':
      return 'done';
    default:
      return 'done';
  }
};

/**
 * Get autocomplete type for autofill support
 */
const getAutoComplete = (inputType: InputType): string => {
  switch (inputType) {
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    case 'address':
      return 'street-address';
    case 'url':
      return 'url';
    default:
      return 'off';
  }
};

/**
 * Validate input value based on type and validation rules
 */
const validateInput = (
  value: string,
  inputType: InputType,
  validation?: NodeUIState.TextInput['validation']
): ValidationResult => {
  // Check required
  if (validation?.required && !value.trim()) {
    return { isValid: false, message: 'This field is required' };
  }

  // If empty and not required, it's valid
  if (!value.trim() && !validation?.required) {
    return { isValid: true };
  }

  // Check min length
  if (validation?.minLength && value.length < validation.minLength) {
    return {
      isValid: false,
      message: `Minimum ${validation.minLength} characters required`,
    };
  }

  // Check max length
  if (validation?.maxLength && value.length > validation.maxLength) {
    return {
      isValid: false,
      message: `Maximum ${validation.maxLength} characters allowed`,
    };
  }

  // Check custom pattern
  if (validation?.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return { isValid: false, message: 'Invalid format' };
    }
  }

  // Type-specific validation
  switch (inputType) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, message: 'Please enter a valid email address' };
      }
      break;
    }

    case 'phone': {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
      if (!phoneRegex.test(value) || value.replace(/[^0-9]/g, '').length < 7) {
        return { isValid: false, message: 'Please enter a valid phone number' };
      }
      break;
    }

    case 'number': {
      const num = parseFloat(value);
      if (isNaN(num)) {
        return { isValid: false, message: 'Please enter a valid number' };
      }
      if (validation?.min !== undefined && num < validation.min) {
        return { isValid: false, message: `Minimum value is ${validation.min}` };
      }
      if (validation?.max !== undefined && num > validation.max) {
        return { isValid: false, message: `Maximum value is ${validation.max}` };
      }
      break;
    }

    case 'url': {
      const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
      if (!urlRegex.test(value)) {
        return { isValid: false, message: 'Please enter a valid URL' };
      }
      break;
    }

    case 'date': {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        return { isValid: false, message: 'Please enter a valid date (YYYY-MM-DD)' };
      }
      break;
    }
  }

  return { isValid: true };
};

// ========================================
// TEXT INPUT FIELD (Reusable)
// ========================================

/**
 * TextInputField component
 *
 * A styled text input field with validation support.
 * Can be used standalone or as part of forms.
 */
export const TextInputField: React.FC<TextInputFieldProps> = ({
  value,
  onChange,
  placeholder = 'Type your answer...',
  inputType = 'text',
  validation,
  errorMessage,
  disabled = false,
  autoFocus = false,
  onSubmit,
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const inputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setLocalError(undefined);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (value) {
      const result = validateInput(value, inputType, validation);
      if (!result.isValid) {
        setLocalError(result.message);
        // Shake animation on error
        Animated.sequence([
          Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      }
    }
  }, [value, inputType, validation, shakeAnimation]);

  const handleChangeText = useCallback(
    (text: string) => {
      onChange(text);
      if (localError) {
        setLocalError(undefined);
      }
    },
    [onChange, localError]
  );

  const handleSubmitEditing = useCallback(() => {
    const result = validateInput(value, inputType, validation);
    if (result.isValid && onSubmit) {
      onSubmit();
    } else if (!result.isValid) {
      setLocalError(result.message);
    }
  }, [value, inputType, validation, onSubmit]);

  const displayError = errorMessage || localError;
  const borderColor = displayError
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <Animated.View
      style={[
        styles.textInputContainer,
        { transform: [{ translateX: shakeAnimation }] },
      ]}
    >
      <TextInput
        ref={inputRef}
        style={[
          styles.textInput,
          {
            backgroundColor: theme.colors.surface,
            borderColor,
            borderRadius: theme.borderRadius.lg,
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
          disabled && styles.textInputDisabled,
        ]}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textDisabled}
        keyboardType={getKeyboardType(inputType)}
        returnKeyType={getReturnKeyType(inputType)}
        autoCapitalize={inputType === 'email' || inputType === 'url' ? 'none' : 'sentences'}
        autoCorrect={inputType !== 'email' && inputType !== 'url'}
        autoComplete={getAutoComplete(inputType) as any}
        editable={!disabled}
        autoFocus={autoFocus}
        multiline={inputType === 'address'}
        numberOfLines={inputType === 'address' ? 3 : 1}
        textContentType={
          inputType === 'email'
            ? 'emailAddress'
            : inputType === 'phone'
            ? 'telephoneNumber'
            : inputType === 'address'
            ? 'fullStreetAddress'
            : undefined
        }
        accessibilityLabel={placeholder}
        accessibilityHint={`Enter ${inputType}`}
      />
      {displayError && (
        <Text
          style={[
            styles.errorText,
            {
              color: theme.colors.error,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
          accessibilityRole="alert"
        >
          {displayError}
        </Text>
      )}
    </Animated.View>
  );
};

// ========================================
// TEXT INPUT COMPONENT (Full Node Component)
// ========================================

/**
 * TextInputComponent
 *
 * Full text input component with question, input field, and submit button.
 * Used for all ask-* node types.
 */
export const TextInputComponent: React.FC<TextInputComponentProps> = ({
  nodeId,
  question,
  placeholder,
  variableName,
  inputType,
  validation,
  errorMessage,
  onSubmit,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const handleSubmit = useCallback(() => {
    // Validate before submitting
    const result = validateInput(value, inputType, validation);

    if (!result.isValid) {
      setLocalError(result.message);
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();

    // Prepare response data
    let responseValue: any = value.trim();

    // Convert to appropriate type
    if (inputType === 'number') {
      responseValue = parseFloat(responseValue);
    }

    onSubmit({
      value: responseValue,
      variableName,
      type: inputType,
    });
  }, [value, inputType, validation, variableName, onSubmit]);

  const isSubmitDisabled = !value.trim() || isSubmitting;

  return (
    <View
      style={[
        styles.inputComponentContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="form"
      accessibilityLabel={`Question: ${question}`}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.normal,
          },
        ]}
      >
        {question}
      </Text>

      <TextInputField
        value={value}
        onChange={setValue}
        placeholder={placeholder || `Enter ${inputType}...`}
        inputType={inputType}
        validation={validation}
        errorMessage={errorMessage || localError}
        disabled={isSubmitting}
        autoFocus
        onSubmit={handleSubmit}
      />

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor: isSubmitDisabled
              ? theme.colors.border
              : theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
        accessibilityRole="button"
        accessibilityLabel="Submit"
        accessibilityState={{ disabled: isSubmitDisabled }}
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color: isSubmitDisabled
                ? theme.colors.textDisabled
                : theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  inputComponentContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  questionText: {
    marginBottom: 16,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  textInputContainer: {
    width: '100%',
    marginBottom: 12,
  },
  textInput: {
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  textInputDisabled: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: 4,
    marginLeft: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  submitButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default {
  TextInputField,
  TextInputComponent,
};
