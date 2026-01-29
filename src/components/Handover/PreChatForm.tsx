/**
 * PreChatForm.tsx
 *
 * Pre-chat form component for collecting user information before
 * connecting to a live agent.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type {
  PreChatFormProps,
  PreChatFormData,
  PreChatField,
  PreChatFieldOption,
} from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// VALIDATION HELPERS
// ========================================

const validators = {
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  phone: (value: string): boolean => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  },
  required: (value: string): boolean => {
    return value.trim().length > 0;
  },
  minLength: (value: string, min: number): boolean => {
    return value.length >= min;
  },
  maxLength: (value: string, max: number): boolean => {
    return value.length <= max;
  },
  pattern: (value: string, pattern: string): boolean => {
    const regex = new RegExp(pattern);
    return regex.test(value);
  },
};

const defaultErrorMessages: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  minLength: 'Input is too short',
  maxLength: 'Input is too long',
  pattern: 'Invalid format',
};

// ========================================
// FIELD COMPONENTS
// ========================================

interface FieldProps {
  field: PreChatField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  theme: ConferBotTheme;
}

const TextField: React.FC<FieldProps> = ({ field, value, error, onChange, theme }) => {
  const keyboardType = field.type === 'email' ? 'email-address' :
                       field.type === 'phone' ? 'phone-pad' : 'default';
  const autoCapitalize = field.type === 'email' ? 'none' : 'sentences';
  const autoComplete = field.type === 'email' ? 'email' :
                       field.type === 'phone' ? 'tel' : 'off';

  return (
    <TextInput
      style={[
        styles.textInput,
        {
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.error : theme.colors.border,
          borderRadius: theme.borderRadius.md,
          color: theme.colors.text,
          fontSize: theme.typography.fontSize.md,
        },
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
      placeholderTextColor={theme.colors.textDisabled}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      accessibilityLabel={field.label}
      accessibilityHint={field.required ? 'Required field' : undefined}
      testID={`prechat-field-${field.id}`}
    />
  );
};

const TextAreaField: React.FC<FieldProps> = ({ field, value, error, onChange, theme }) => {
  return (
    <TextInput
      style={[
        styles.textArea,
        {
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.error : theme.colors.border,
          borderRadius: theme.borderRadius.md,
          color: theme.colors.text,
          fontSize: theme.typography.fontSize.md,
        },
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
      placeholderTextColor={theme.colors.textDisabled}
      multiline
      numberOfLines={4}
      textAlignVertical="top"
      accessibilityLabel={field.label}
      testID={`prechat-field-${field.id}`}
    />
  );
};

interface SelectFieldProps extends FieldProps {
  options: PreChatFieldOption[];
}

const SelectField: React.FC<SelectFieldProps> = ({ field, value, error, onChange, options, theme }) => {
  return (
    <View style={styles.selectContainer}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.selectOption,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.borderRadius.sm,
              },
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            testID={`prechat-option-${field.id}-${option.value}`}
          >
            <Text
              style={[
                styles.selectOptionText,
                {
                  color: isSelected ? theme.colors.textInverse : theme.colors.text,
                  fontSize: theme.typography.fontSize.sm,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ========================================
// DEPARTMENT SELECTOR
// ========================================

interface DepartmentSelectorProps {
  departments: NonNullable<PreChatFormProps['config']['departments']>;
  selectedId?: string;
  onSelect: (id: string) => void;
  theme: ConferBotTheme;
}

const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  departments,
  selectedId,
  onSelect,
  theme,
}) => {
  return (
    <View style={styles.departmentContainer}>
      <Text
        style={[
          styles.departmentTitle,
          { color: theme.colors.text, fontSize: theme.typography.fontSize.md },
        ]}
      >
        Select Department
      </Text>
      <View style={styles.departmentList}>
        {departments.map((dept) => {
          const isSelected = selectedId === dept.id;
          return (
            <TouchableOpacity
              key={dept.id}
              style={[
                styles.departmentItem,
                {
                  backgroundColor: isSelected
                    ? `${theme.colors.primary}15`
                    : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
              onPress={() => onSelect(dept.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={dept.name}
            >
              <View style={styles.departmentContent}>
                <View style={styles.departmentHeader}>
                  <View
                    style={[
                      styles.departmentRadio,
                      {
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[
                          styles.departmentRadioInner,
                          { backgroundColor: theme.colors.textInverse },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.departmentName,
                      {
                        color: theme.colors.text,
                        fontSize: theme.typography.fontSize.md,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {dept.name}
                  </Text>
                </View>
                {dept.description && (
                  <Text
                    style={[
                      styles.departmentDescription,
                      {
                        color: theme.colors.textSecondary,
                        fontSize: theme.typography.fontSize.sm,
                      },
                    ]}
                  >
                    {dept.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

export const PreChatForm: React.FC<PreChatFormProps> = ({
  config,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const theme = useTheme();
  const [formData, setFormData] = useState<PreChatFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Validate a single field
  const validateField = useCallback(
    (field: PreChatField, value: string): string | undefined => {
      if (field.required && !validators.required(value)) {
        return field.validation?.errorMessage || defaultErrorMessages.required;
      }

      if (value && field.type === 'email' && !validators.email(value)) {
        return field.validation?.errorMessage || defaultErrorMessages.email;
      }

      if (value && field.type === 'phone' && !validators.phone(value)) {
        return field.validation?.errorMessage || defaultErrorMessages.phone;
      }

      if (value && field.validation?.minLength && !validators.minLength(value, field.validation.minLength)) {
        return field.validation.errorMessage || `Minimum ${field.validation.minLength} characters required`;
      }

      if (value && field.validation?.maxLength && !validators.maxLength(value, field.validation.maxLength)) {
        return field.validation.errorMessage || `Maximum ${field.validation.maxLength} characters allowed`;
      }

      if (value && field.validation?.pattern && !validators.pattern(value, field.validation.pattern)) {
        return field.validation.errorMessage || defaultErrorMessages.pattern;
      }

      return undefined;
    },
    []
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (fieldId: string, value: string) => {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));

      // Clear error if field was touched
      if (touched[fieldId]) {
        const field = config.fields.find((f) => f.id === fieldId);
        if (field) {
          const error = validateField(field, value);
          setErrors((prev) => {
            const newErrors = { ...prev };
            if (error) {
              newErrors[fieldId] = error;
            } else {
              delete newErrors[fieldId];
            }
            return newErrors;
          });
        }
      }
    },
    [config.fields, touched, validateField]
  );

  // Handle field blur (mark as touched)
  const handleFieldBlur = useCallback(
    (fieldId: string) => {
      setTouched((prev) => ({ ...prev, [fieldId]: true }));

      const field = config.fields.find((f) => f.id === fieldId);
      if (field) {
        const value = formData[fieldId] || '';
        const error = validateField(field, value);
        if (error) {
          setErrors((prev) => ({ ...prev, [fieldId]: error }));
        }
      }
    },
    [config.fields, formData, validateField]
  );

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    for (const field of config.fields) {
      const value = formData[field.id] || '';
      const error = validateField(field, value);
      if (error) {
        newErrors[field.id] = error;
        isValid = false;
      }
    }

    // Check department if required
    if (config.showDepartmentSelector && config.departments && config.departments.length > 0 && !selectedDepartment) {
      isValid = false;
    }

    setErrors(newErrors);
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    for (const field of config.fields) {
      allTouched[field.id] = true;
    }
    setTouched(allTouched);

    return isValid;
  }, [config.fields, config.showDepartmentSelector, config.departments, formData, selectedDepartment, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;

    if (validateForm()) {
      onSubmit(formData, selectedDepartment);
    }
  }, [formData, selectedDepartment, isSubmitting, validateForm, onSubmit]);

  // Render field
  const renderField = useCallback(
    (field: PreChatField) => {
      const value = formData[field.id] || '';
      const error = touched[field.id] ? errors[field.id] : undefined;

      return (
        <View key={field.id} style={styles.fieldContainer}>
          <View style={styles.labelContainer}>
            <Text
              style={[
                styles.fieldLabel,
                { color: theme.colors.text, fontSize: theme.typography.fontSize.sm },
              ]}
            >
              {field.label}
            </Text>
            {field.required && (
              <Text style={[styles.requiredMark, { color: theme.colors.error }]}>*</Text>
            )}
          </View>

          {field.type === 'select' && field.options ? (
            <SelectField
              field={field}
              value={value}
              error={error}
              onChange={(v) => handleFieldChange(field.id, v)}
              options={field.options}
              theme={theme}
            />
          ) : field.type === 'textarea' ? (
            <TextAreaField
              field={field}
              value={value}
              error={error}
              onChange={(v) => handleFieldChange(field.id, v)}
              theme={theme}
            />
          ) : (
            <TextField
              field={field}
              value={value}
              error={error}
              onChange={(v) => handleFieldChange(field.id, v)}
              theme={theme}
            />
          )}

          {error && (
            <Text
              style={[
                styles.errorText,
                { color: theme.colors.error, fontSize: theme.typography.fontSize.xs },
              ]}
            >
              {error}
            </Text>
          )}
        </View>
      );
    },
    [formData, errors, touched, theme, handleFieldChange]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            opacity: fadeAnim,
          },
          theme.shadows.md,
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: theme.colors.text, fontSize: theme.typography.fontSize.xl },
              ]}
            >
              {config.title || 'Before we connect you'}
            </Text>
            {config.subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
                ]}
              >
                {config.subtitle}
              </Text>
            )}
          </View>

          {/* Department Selector */}
          {config.showDepartmentSelector && config.departments && config.departments.length > 0 && (
            <DepartmentSelector
              departments={config.departments}
              selectedId={selectedDepartment}
              onSelect={setSelectedDepartment}
              theme={theme}
            />
          )}

          {/* Form Fields */}
          <View style={styles.fieldsContainer}>
            {config.fields.map(renderField)}
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.borderRadius.md,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={config.submitButtonText || 'Start Chat'}
              accessibilityState={{ disabled: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.textInverse} />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    { color: theme.colors.textInverse, fontSize: theme.typography.fontSize.md },
                  ]}
                >
                  {config.submitButtonText || 'Start Chat'}
                </Text>
              )}
            </TouchableOpacity>

            {onCancel && (
              <TouchableOpacity
                style={[styles.cancelButton, { borderRadius: theme.borderRadius.md }]}
                onPress={onCancel}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 20,
    maxWidth: SCREEN_WIDTH - 24,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    lineHeight: 20,
  },
  fieldsContainer: {
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  requiredMark: {
    marginLeft: 4,
    fontWeight: '600',
  },
  textInput: {
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  textArea: {
    minHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  selectOptionText: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  errorText: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  departmentContainer: {
    marginBottom: 24,
  },
  departmentTitle: {
    fontWeight: '500',
    marginBottom: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  departmentList: {
    gap: 8,
  },
  departmentItem: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  departmentContent: {
    flex: 1,
  },
  departmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  departmentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  departmentRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  departmentName: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  departmentDescription: {
    marginTop: 4,
    marginLeft: 32,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  actionsContainer: {
    marginTop: 8,
  },
  submitButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default PreChatForm;
