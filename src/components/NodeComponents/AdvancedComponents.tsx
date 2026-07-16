// @ts-nocheck
/**
 * AdvancedComponents.tsx
 *
 * Components for advanced inputs.
 * Includes: CalendarPicker, MultiFieldForm, FileUploadButton, LocationInput
 */

import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { getApiOrigin } from '../../config/constants';
import {
  FilePicker,
  FilePickerResult,
  FilePickerError,
  formatFileSize,
  isFilePickerAvailable,
  isImagePickerAvailable,
} from '../../utils/FilePicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;

// Maximum file size (5MB default)
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

// ========================================
// CALENDAR PICKER
// ========================================

interface CalendarPickerProps extends NodeUIState.Calendar {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * CalendarPicker component
 *
 * Displays a date/time picker.
 * Supports date, time, datetime, and date range modes.
 */
export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  nodeId,
  question,
  variableName,
  mode = 'date',
  minDate,
  maxDate,
  availableSlots,
  showTimeSlots = false,
  onSubmit,
}) => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatDisplayDate = (date: Date): string => {
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = formatDate(date);

    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;

    if (availableSlots && availableSlots.length > 0) {
      return !availableSlots.some(slot => slot.date === dateStr);
    }

    return false;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return formatDate(date) === formatDate(selectedDate);
  };

  const handleDateSelect = useCallback((day: number) => {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);

    if (mode === 'dateRange' && selectedDate && !selectedEndDate) {
      if (date >= selectedDate) {
        setSelectedEndDate(date);
      } else {
        setSelectedDate(date);
        setSelectedEndDate(null);
      }
    } else {
      setSelectedDate(date);
      setSelectedEndDate(null);
      setSelectedTime(null);
    }
  }, [mode, selectedDate, selectedEndDate, viewMonth]);

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedDate) return;

    setIsSubmitting(true);

    let response: any = {
      variableName,
      mode,
    };

    switch (mode) {
      case 'date':
        response.date = formatDate(selectedDate);
        response.displayDate = formatDisplayDate(selectedDate);
        break;
      case 'time':
        response.time = selectedTime;
        break;
      case 'datetime':
        response.date = formatDate(selectedDate);
        response.time = selectedTime;
        response.datetime = `${formatDate(selectedDate)}T${selectedTime}`;
        break;
      case 'dateRange':
        response.startDate = formatDate(selectedDate);
        response.endDate = selectedEndDate ? formatDate(selectedEndDate) : formatDate(selectedDate);
        break;
    }

    onSubmit(response);
  }, [selectedDate, selectedEndDate, selectedTime, mode, variableName, onSubmit]);

  const renderCalendar = () => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarNavButton}>
            <Text style={[styles.calendarNavText, { color: theme.colors.primary }]}>
              {'\u25C0'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
            {months[month]} {year}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.calendarNavButton}>
            <Text style={[styles.calendarNavText, { color: theme.colors.primary }]}>
              {'\u25B6'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarDaysOfWeek}>
          {daysOfWeek.map(day => (
            <Text
              key={day}
              style={[
                styles.dayOfWeekText,
                { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.xs }
              ]}
            >
              {day}
            </Text>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.calendarWeek}>
            {week.map((day, dayIndex) => {
              if (day === null) {
                return <View key={dayIndex} style={styles.calendarDayEmpty} />;
              }

              const date = new Date(year, month, day);
              const disabled = isDateDisabled(date);
              const selected = isDateSelected(date);
              const isInRange = mode === 'dateRange' && selectedDate && selectedEndDate &&
                date >= selectedDate && date <= selectedEndDate;

              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.calendarDay,
                    selected && {
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.borderRadius.full,
                    },
                    isInRange && !selected && {
                      backgroundColor: theme.colors.primaryLight,
                    },
                    disabled && styles.calendarDayDisabled,
                  ]}
                  onPress={() => !disabled && handleDateSelect(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${months[month]} ${day}, ${year}`}
                  accessibilityState={{ selected, disabled }}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      {
                        color: selected
                          ? theme.colors.textInverse
                          : disabled
                          ? theme.colors.textDisabled
                          : theme.colors.text,
                        fontSize: theme.typography.fontSize.sm,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderTimeSlots = () => {
    if (!selectedDate || !showTimeSlots) return null;

    const dateStr = formatDate(selectedDate);
    const slot = availableSlots?.find(s => s.date === dateStr);
    const times = slot?.times || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

    return (
      <View style={styles.timeSlotsContainer}>
        <Text style={[styles.timeSlotsTitle, { color: theme.colors.text }]}>
          Select a time
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {times.map(time => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeSlot,
                {
                  backgroundColor: selectedTime === time
                    ? theme.colors.primary
                    : theme.colors.surface,
                  borderColor: selectedTime === time
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
              onPress={() => handleTimeSelect(time)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedTime === time }}
              accessibilityLabel={time}
            >
              <Text
                style={[
                  styles.timeSlotText,
                  {
                    color: selectedTime === time
                      ? theme.colors.textInverse
                      : theme.colors.text,
                    fontSize: theme.typography.fontSize.sm,
                  },
                ]}
              >
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const getDisplayValue = (): string => {
    if (!selectedDate) return 'Select a date...';

    let display = formatDisplayDate(selectedDate);

    if (mode === 'dateRange' && selectedEndDate) {
      display += ` - ${formatDisplayDate(selectedEndDate)}`;
    }

    if ((mode === 'time' || mode === 'datetime') && selectedTime) {
      display += ` at ${selectedTime}`;
    }

    return display;
  };

  const canSubmit = (): boolean => {
    if (!selectedDate) return false;
    if ((mode === 'time' || mode === 'datetime') && showTimeSlots && !selectedTime) return false;
    return true;
  };

  return (
    <View
      style={[
        styles.calendarContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="none"
      accessibilityLabel={question}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      <TouchableOpacity
        style={[
          styles.datePickerTrigger,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => setIsModalVisible(true)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={getDisplayValue()}
      >
        <Text
          style={[
            styles.datePickerTriggerText,
            {
              color: selectedDate ? theme.colors.text : theme.colors.textDisabled,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {getDisplayValue()}
        </Text>
        <Text style={[styles.datePickerIcon, { color: theme.colors.textSecondary }]}>
          {'\uD83D\uDCC5'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <View
            style={[
              styles.calendarModal,
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.borderRadius.xl,
                borderTopRightRadius: theme.borderRadius.xl,
              },
            ]}
          >
            <View style={styles.modalHandle}>
              <View style={[styles.handleBar, { backgroundColor: theme.colors.border }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {renderCalendar()}
              {renderTimeSlots()}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                {
                  backgroundColor: canSubmit()
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
              onPress={() => {
                setIsModalVisible(false);
              }}
              disabled={!canSubmit()}
            >
              <Text
                style={[
                  styles.modalSubmitText,
                  {
                    color: canSubmit()
                      ? theme.colors.textInverse
                      : theme.colors.textDisabled,
                  },
                ]}
              >
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor: canSubmit()
              ? theme.colors.primary
              : theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit() || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit"
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color: canSubmit()
                ? theme.colors.textInverse
                : theme.colors.textDisabled,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// MULTI FIELD FORM
// ========================================

interface MultiFieldFormProps extends NodeUIState.MultipleQuestions {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * MultiFieldForm component
 *
 * Displays a form with multiple question fields.
 */
export const MultiFieldForm: React.FC<MultiFieldFormProps> = ({
  nodeId,
  title,
  questions,
  submitLabel = 'Submit',
  onSubmit,
}) => {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValueChange = useCallback((questionId: string, value: any) => {
    setValues(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    questions.forEach(q => {
      const value = values[q.id];

      if (q.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[q.id] = 'This field is required';
        return;
      }

      if (value && q.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[q.id] = 'Please enter a valid email';
        }
      }

      if (value && q.type === 'phone') {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
        if (!phoneRegex.test(value)) {
          newErrors[q.id] = 'Please enter a valid phone number';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [questions, values]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    const formData: Record<string, any> = {};
    questions.forEach(q => {
      formData[q.variableName] = values[q.id] ?? null;
    });

    onSubmit({
      formData,
      values,
    });
  }, [validateForm, questions, values, onSubmit]);

  const renderField = (question: MultiFieldFormProps['questions'][0]) => {
    const value = values[question.id] ?? '';
    const error = errors[question.id];

    switch (question.type) {
      case 'select':
      case 'multiselect':
        return (
          <View key={question.id} style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
              {question.question}
              {question.required && <Text style={{ color: theme.colors.error }}> *</Text>}
            </Text>
            <View style={styles.selectOptionsContainer}>
              {question.options?.map(option => {
                const isSelected = question.type === 'multiselect'
                  ? (value as string[] || []).includes(option.value)
                  : value === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.selectOption,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.border,
                        borderRadius: theme.borderRadius.sm,
                      },
                    ]}
                    onPress={() => {
                      if (question.type === 'multiselect') {
                        const currentValues = (value as string[]) || [];
                        const newValues = isSelected
                          ? currentValues.filter(v => v !== option.value)
                          : [...currentValues, option.value];
                        handleValueChange(question.id, newValues);
                      } else {
                        handleValueChange(question.id, option.value);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        {
                          color: isSelected
                            ? theme.colors.textInverse
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {error && (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View key={question.id} style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
              {question.question}
              {question.required && <Text style={{ color: theme.colors.error }}> *</Text>}
            </Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: error ? theme.colors.error : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                  color: theme.colors.text,
                },
              ]}
              value={value}
              onChangeText={(text) => handleValueChange(question.id, text)}
              placeholder={question.placeholder}
              placeholderTextColor={theme.colors.textDisabled}
              keyboardType={
                question.type === 'email' ? 'email-address' :
                question.type === 'phone' ? 'phone-pad' :
                question.type === 'number' ? 'numeric' :
                'default'
              }
              autoCapitalize={
                question.type === 'email' ? 'none' : 'sentences'
              }
            />
            {error && (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.multiFieldContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
    >
      {title && (
        <Text
          style={[
            styles.formTitle,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.lg,
            },
          ]}
        >
          {title}
        </Text>
      )}

      <ScrollView style={styles.formScroll} nestedScrollEnabled>
        {questions.map(renderField)}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : submitLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// FILE UPLOAD BUTTON
// ========================================

interface FileUploadButtonProps extends NodeUIState.FileUpload {
  onSubmit: (response: any, portName?: string) => void;
  /** Optional API upload function */
  uploadFile?: (file: FilePickerResult) => Promise<{ url: string; fileName: string }>;
  /** Bot ID for file upload endpoint */
  botId?: string;
  /** Base API URL for file upload */
  apiBaseUrl?: string;
}

/**
 * FileUploadButton component
 *
 * Displays a file upload button with support for:
 * - Document selection (PDF, Word, Excel, etc.)
 * - Image selection from gallery
 * - Camera capture
 * - Video selection
 *
 * Requires one of these libraries to be installed:
 * - react-native-document-picker (for documents)
 * - expo-document-picker (for documents)
 * - react-native-image-picker (for images/camera)
 * - expo-image-picker (for images/camera)
 */
export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  nodeId,
  question,
  variableName,
  acceptedTypes,
  maxSize = DEFAULT_MAX_FILE_SIZE,
  multiple = false,
  onSubmit,
  uploadFile: externalUploadFile,
  botId,
  apiBaseUrl,
}) => {
  const theme = useTheme();
  // Optional provider context: supplies session/bot info when props are omitted
  const conferBot = useContext(ConferBotContext);
  const chatSessionId = conferBot?.chatSessionId;
  const resolvedBotId = botId || conferBot?.chatbotConfig?.id;
  const [selectedFiles, setSelectedFiles] = useState<FilePickerResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});

  // Check which pickers are available
  const hasFilePicker = isFilePickerAvailable();
  const hasImagePicker = isImagePickerAvailable();
  const hasAnyPicker = hasFilePicker || hasImagePicker;

  /**
   * Upload a file to the server
   */
  const uploadFileToServer = useCallback(async (file: FilePickerResult): Promise<string> => {
    // If an external upload function is provided, use it
    if (externalUploadFile) {
      const result = await externalUploadFile(file);
      return result.url;
    }

    // Otherwise, use the default upload endpoint
    if (!resolvedBotId) {
      throw new Error('Bot ID is required for file upload');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    // Simulate progress for demo (actual progress requires XMLHttpRequest)
    setUploadProgress(prev => ({ ...prev, [file.id]: 0 }));

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[file.id] || 0;
        if (current >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [file.id]: current + 10 };
      });
    }, 200);

    try {
      // Derive the origin from the configured endpoint (strips /api/v1/mobile)
      // and pass the chat session so the upload is attached to this conversation
      const sessionQuery = chatSessionId
        ? `?chatSessionId=${encodeURIComponent(chatSessionId)}`
        : '';

      const response = await fetch(
        `${getApiOrigin(apiBaseUrl)}/api/v1/bot/${resolvedBotId}/media${sessionQuery}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [file.id]: 100 }));

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }, [externalUploadFile, resolvedBotId, apiBaseUrl, chatSessionId]);

  /**
   * Handle file picker action
   */
  const handleFilePick = useCallback(async (type: 'document' | 'image' | 'camera' | 'all') => {
    setUploadError(null);

    try {
      let files: FilePickerResult[] = [];

      switch (type) {
        case 'document':
          files = await FilePicker.pickDocuments({
            multiple,
            maxSize,
            maxFiles: multiple ? 10 : 1,
          });
          break;

        case 'image':
          files = await FilePicker.pickImages({
            multiple,
            maxSize,
            maxFiles: multiple ? 10 : 1,
            quality: 0.8,
          });
          break;

        case 'camera':
          const photo = await FilePicker.takePhoto({
            maxSize,
            quality: 0.8,
          });
          if (photo) {
            files = [photo];
          }
          break;

        case 'all':
          files = await FilePicker.pick({
            multiple,
            maxSize,
            maxFiles: multiple ? 10 : 1,
            types: ['all'],
          });
          break;
      }

      if (files.length > 0) {
        if (multiple) {
          setSelectedFiles(prev => [...prev, ...files]);
        } else {
          setSelectedFiles(files);
        }
      }
    } catch (error) {
      if (error instanceof FilePickerError) {
        if (error.code === 'FILE_TOO_LARGE') {
          setUploadError(`File too large. Maximum size is ${formatFileSize(maxSize)}`);
        } else if (error.code !== 'NOT_AVAILABLE') {
          setUploadError(error.message);
        }
      } else {
        console.error('[FileUploadButton] Pick error:', error);
        setUploadError('Failed to select file. Please try again.');
      }
    }
  }, [multiple, maxSize]);

  /**
   * Show action sheet with picker options
   */
  const showPickerOptions = useCallback(() => {
    const buttons: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = [];

    if (hasImagePicker) {
      buttons.push({
        text: 'Take Photo',
        onPress: () => handleFilePick('camera'),
      });
      buttons.push({
        text: 'Choose from Gallery',
        onPress: () => handleFilePick('image'),
      });
    }

    if (hasFilePicker) {
      buttons.push({
        text: 'Choose Document',
        onPress: () => handleFilePick('document'),
      });
    }

    // Fallback if no pickers but still want to show UI
    if (!hasAnyPicker) {
      Alert.alert(
        'File Picker Not Available',
        'Please install react-native-document-picker, expo-document-picker, react-native-image-picker, or expo-image-picker to enable file selection.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    buttons.push({
      text: 'Cancel',
      style: 'cancel',
      onPress: () => {},
    });

    Alert.alert('Select File', 'Choose how you want to add a file', buttons);
  }, [hasFilePicker, hasImagePicker, hasAnyPicker, handleFilePick]);

  /**
   * Remove a selected file
   */
  const handleRemoveFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
    setUploadedUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[fileId];
      return newUrls;
    });
  }, []);

  /**
   * Submit files
   */
  const handleSubmit = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadResults: Array<{ name: string; url: string; size: number; type: string }> = [];

      for (const file of selectedFiles) {
        // Check if already uploaded
        if (uploadedUrls[file.id]) {
          uploadResults.push({
            name: file.name,
            url: uploadedUrls[file.id],
            size: file.size,
            type: file.type,
          });
          continue;
        }

        // Upload the file
        const url = await uploadFileToServer(file);

        setUploadedUrls(prev => ({ ...prev, [file.id]: url }));

        uploadResults.push({
          name: file.name,
          url,
          size: file.size,
          type: file.type,
        });
      }

      // Submit the response
      onSubmit({
        files: uploadResults,
        variableName,
        // For single file, also include direct properties for backward compatibility
        ...(uploadResults.length === 1 && {
          fileName: uploadResults[0].name,
          url: uploadResults[0].url,
          fileSize: uploadResults[0].size,
          fileType: uploadResults[0].type,
        }),
      });
    } catch (error: any) {
      console.error('[FileUploadButton] Upload error:', error);
      setUploadError(error.message || 'Failed to upload file. Please try again.');
      setIsUploading(false);
    }
  }, [selectedFiles, uploadedUrls, uploadFileToServer, onSubmit, variableName]);

  /**
   * Get accepted types text
   */
  const getAcceptedTypesText = (): string => {
    if (!acceptedTypes || acceptedTypes.length === 0) {
      return 'All files';
    }
    return acceptedTypes.map(t => t.replace('.', '').toUpperCase()).join(', ');
  };

  /**
   * Check if file is an image
   */
  const isImageFile = (file: FilePickerResult): boolean => {
    return file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(file.extension.toLowerCase());
  };

  /**
   * Get file icon based on type
   */
  const getFileIcon = (file: FilePickerResult): string => {
    if (isImageFile(file)) return '\uD83D\uDDBC'; // Picture frame
    if (file.type.startsWith('video/')) return '\uD83C\uDFA5'; // Movie camera
    if (file.type.startsWith('audio/')) return '\uD83C\uDFB5'; // Musical note
    if (file.type === 'application/pdf') return '\uD83D\uDCC4'; // Page
    if (file.type.includes('word') || file.type.includes('document')) return '\uD83D\uDCDD'; // Memo
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return '\uD83D\uDCCA'; // Chart
    return '\uD83D\uDCC1'; // Folder
  };

  return (
    <View
      style={[
        styles.fileUploadContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      {/* Upload Area */}
      <TouchableOpacity
        style={[
          styles.uploadButton,
          {
            backgroundColor: theme.colors.background,
            borderColor: uploadError ? theme.colors.error : theme.colors.border,
            borderRadius: theme.borderRadius.lg,
          },
        ]}
        onPress={showPickerOptions}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel="Select file to upload"
      >
        <Text style={styles.uploadIcon}>{'\uD83D\uDCC1'}</Text>
        <Text
          style={[
            styles.uploadText,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {multiple ? 'Choose Files' : 'Choose File'}
        </Text>
        <Text
          style={[
            styles.uploadHint,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.xs,
            },
          ]}
        >
          {getAcceptedTypesText()} (Max: {formatFileSize(maxSize)})
        </Text>
        {!hasAnyPicker && (
          <Text
            style={[
              styles.uploadWarning,
              {
                color: theme.colors.warning || '#F59E0B',
                fontSize: theme.typography.fontSize.xs,
              },
            ]}
          >
            File picker library not installed
          </Text>
        )}
      </TouchableOpacity>

      {/* Error Message */}
      {uploadError && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {uploadError}
        </Text>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <View style={styles.selectedFilesList}>
          {selectedFiles.map((file) => {
            const progress = uploadProgress[file.id];
            const isUploaded = !!uploadedUrls[file.id];

            return (
              <View
                key={file.id}
                style={[
                  styles.selectedFile,
                  {
                    backgroundColor: theme.colors.background,
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                {/* File Preview/Icon */}
                {isImageFile(file) ? (
                  <Image
                    source={{ uri: file.uri }}
                    style={styles.filePreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fileIconContainer, { backgroundColor: theme.colors.primaryLight }]}>
                    <Text style={styles.fileIcon}>{getFileIcon(file)}</Text>
                  </View>
                )}

                {/* File Info */}
                <View style={styles.selectedFileInfo}>
                  <Text
                    style={[
                      styles.selectedFileName,
                      { color: theme.colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text
                    style={[
                      styles.selectedFileSize,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {formatFileSize(file.size)}
                    {isUploaded && ' - Uploaded'}
                  </Text>

                  {/* Upload Progress */}
                  {progress !== undefined && progress < 100 && !isUploaded && (
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { backgroundColor: theme.colors.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: theme.colors.primary,
                              width: `${progress}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                        {progress}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Remove Button */}
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => handleRemoveFile(file.id)}
                  disabled={isUploading}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${file.name}`}
                >
                  <Text style={[styles.removeFileIcon, { color: theme.colors.error }]}>
                    {'\u2715'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              selectedFiles.length === 0 || isUploading
                ? theme.colors.border
                : theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={selectedFiles.length === 0 || isUploading}
        accessibilityRole="button"
        accessibilityLabel="Upload files"
      >
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
            <Text
              style={[
                styles.submitButtonText,
                { color: theme.colors.textInverse, marginLeft: 8 },
              ]}
            >
              Uploading...
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.submitButtonText,
              {
                color:
                  selectedFiles.length === 0
                    ? theme.colors.textDisabled
                    : theme.colors.textInverse,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            Upload
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// LOCATION INPUT
// ========================================

interface LocationInputProps extends NodeUIState.LocationPicker {
  onSubmit: (response: any, portName?: string) => void;
}

/**
 * LocationInput component
 *
 * Displays a location/address input.
 * Supports manual address entry and optional map display.
 */
export const LocationInput: React.FC<LocationInputProps> = ({
  nodeId,
  question,
  variableName,
  allowManualEntry = true,
  showMap = false,
  onSubmit,
}) => {
  const theme = useTheme();
  const [address, setAddress] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const handleGetCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true);

    // In a real implementation, use @react-native-community/geolocation or expo-location
    Alert.alert(
      'Location Access',
      'This would request location permissions and get your current location. Integrate with @react-native-community/geolocation or expo-location for full functionality.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsGettingLocation(false) },
        {
          text: 'Simulate Location',
          onPress: () => {
            // Simulate location for demo purposes
            setCoordinates({ lat: 40.7128, lng: -74.0060 });
            setAddress('New York, NY, USA');
            setIsGettingLocation(false);
          },
        },
      ]
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!address.trim() && !coordinates) return;

    setIsSubmitting(true);

    onSubmit({
      address: address.trim(),
      coordinates,
      variableName,
    });
  }, [address, coordinates, variableName, onSubmit]);

  return (
    <View
      style={[
        styles.locationContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      <TouchableOpacity
        style={[
          styles.locationButton,
          {
            backgroundColor: theme.colors.primaryLight,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleGetCurrentLocation}
        disabled={isGettingLocation || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
      >
        <Text style={styles.locationButtonIcon}>{'\uD83D\uDCCD'}</Text>
        <Text
          style={[
            styles.locationButtonText,
            {
              color: theme.colors.primary,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isGettingLocation ? 'Getting location...' : 'Use Current Location'}
        </Text>
      </TouchableOpacity>

      {allowManualEntry && (
        <>
          <Text
            style={[
              styles.orText,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
              },
            ]}
          >
            or enter manually
          </Text>

          <TextInput
            style={[
              styles.addressInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter your address..."
            placeholderTextColor={theme.colors.textDisabled}
            multiline
            numberOfLines={3}
            editable={!isSubmitting}
          />
        </>
      )}

      {coordinates && (
        <View
          style={[
            styles.coordinatesDisplay,
            {
              backgroundColor: theme.colors.background,
              borderRadius: theme.borderRadius.sm,
            },
          ]}
        >
          <Text
            style={[
              styles.coordinatesText,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.xs,
              },
            ]}
          >
            Lat: {coordinates.lat.toFixed(6)}, Lng: {coordinates.lng.toFixed(6)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              !address.trim() && !coordinates
                ? theme.colors.border
                : theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={(!address.trim() && !coordinates) || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit location"
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color:
                !address.trim() && !coordinates
                  ? theme.colors.textDisabled
                  : theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  // Common styles
  questionText: {
    marginBottom: 16,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  submitButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  // Calendar styles
  calendarContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  datePickerTriggerText: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  datePickerIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  calendarModal: {
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  calendar: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarNavText: {
    fontSize: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  calendarDaysOfWeek: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayOfWeekText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  calendarDayEmpty: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  timeSlotsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  timeSlotsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  timeSlot: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  timeSlotText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  modalSubmitButton: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontWeight: '600',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Multi Field Form styles
  multiFieldContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  formTitle: {
    fontWeight: '600',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  formScroll: {
    maxHeight: 400,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  selectOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  selectOptionText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // File Upload styles
  fileUploadContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  uploadText: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  uploadHint: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  uploadWarning: {
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  selectedFilesList: {
    marginTop: 16,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  filePreviewImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    fontSize: 24,
  },
  selectedFileInfo: {
    flex: 1,
  },
  selectedFileName: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  selectedFileSize: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  removeFileButton: {
    padding: 8,
  },
  removeFileIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Location styles
  locationContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  locationButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  locationButtonText: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  orText: {
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  addressInput: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    textAlignVertical: 'top',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  coordinatesDisplay: {
    marginTop: 8,
    padding: 8,
  },
  coordinatesText: {
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default {
  CalendarPicker,
  MultiFieldForm,
  FileUploadButton,
  LocationInput,
};
