/**
 * ValidationUtils.ts
 *
 * Validation utilities for the Conferbot React Native SDK.
 * Provides validation functions for common input types.
 */

// ========================================
// VALIDATION RESULT
// ========================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

// ========================================
// EMAIL VALIDATION
// ========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address
 */
export function validateEmail(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = value.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// PHONE VALIDATION
// ========================================

const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

/**
 * Validates a phone number
 */
export function validatePhone(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  if (!PHONE_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid phone number format' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// NAME VALIDATION
// ========================================

/**
 * Validates a name
 */
export function validateName(value: string, minLength: number = 1): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'Name is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { isValid: false, error: `Name must be at least ${minLength} characters` };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Name is too long' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// NUMBER VALIDATION
// ========================================

interface NumberValidationOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
}

/**
 * Validates a number
 */
export function validateNumber(
  value: string | number,
  options: NumberValidationOptions = {}
): ValidationResult {
  const { min, max, integer = false, required = true } = options;

  if (value === '' || value === null || value === undefined) {
    if (required) {
      return { isValid: false, error: 'A number is required' };
    }
    return { isValid: true, sanitizedValue: null };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }

  if (integer && !Number.isInteger(numValue)) {
    return { isValid: false, error: 'Please enter a whole number' };
  }

  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `Value must be at most ${max}` };
  }

  return { isValid: true, sanitizedValue: numValue };
}

// ========================================
// URL VALIDATION
// ========================================

const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

/**
 * Validates a URL
 */
export function validateUrl(value: string, requireProtocol: boolean = false): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'URL is required' };
  }

  let trimmed = value.trim();

  // Add protocol if missing and not required
  if (!trimmed.match(/^https?:\/\//i)) {
    if (requireProtocol) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }
    trimmed = 'https://' + trimmed;
  }

  try {
    new URL(trimmed);
    return { isValid: true, sanitizedValue: trimmed };
  } catch {
    if (!URL_REGEX.test(trimmed)) {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
    return { isValid: true, sanitizedValue: trimmed };
  }
}

// ========================================
// DATE VALIDATION
// ========================================

interface DateValidationOptions {
  minDate?: Date | string;
  maxDate?: Date | string;
  format?: 'date' | 'datetime' | 'time';
}

/**
 * Validates a date
 */
export function validateDate(
  value: string | Date,
  options: DateValidationOptions = {}
): ValidationResult {
  const { minDate, maxDate } = options;

  if (!value) {
    return { isValid: false, error: 'Date is required' };
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Please enter a valid date' };
  }

  if (minDate) {
    const min = typeof minDate === 'string' ? new Date(minDate) : minDate;
    if (date < min) {
      return { isValid: false, error: `Date must be on or after ${min.toLocaleDateString()}` };
    }
  }

  if (maxDate) {
    const max = typeof maxDate === 'string' ? new Date(maxDate) : maxDate;
    if (date > max) {
      return { isValid: false, error: `Date must be on or before ${max.toLocaleDateString()}` };
    }
  }

  return { isValid: true, sanitizedValue: date.toISOString() };
}

// ========================================
// ADDRESS VALIDATION
// ========================================

/**
 * Validates an address
 */
export function validateAddress(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'Address is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < 5) {
    return { isValid: false, error: 'Please enter a complete address' };
  }

  if (trimmed.length > 500) {
    return { isValid: false, error: 'Address is too long' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// FILE VALIDATION
// ========================================

interface FileValidationOptions {
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  required?: boolean;
}

/**
 * Validates a file
 */
export function validateFile(
  file: { name: string; size: number; type: string } | null,
  options: FileValidationOptions = {}
): ValidationResult {
  const { maxSize, acceptedTypes, required = true } = options;

  if (!file) {
    if (required) {
      return { isValid: false, error: 'Please select a file' };
    }
    return { isValid: true, sanitizedValue: null };
  }

  if (maxSize && file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  if (acceptedTypes && acceptedTypes.length > 0) {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type.toLowerCase();

    const isAccepted = acceptedTypes.some((type) => {
      const normalizedType = type.toLowerCase().replace('.', '');
      return (
        fileExt === normalizedType ||
        mimeType === type ||
        mimeType.startsWith(normalizedType + '/')
      );
    });

    if (!isAccepted) {
      return {
        isValid: false,
        error: `Accepted file types: ${acceptedTypes.join(', ')}`,
      };
    }
  }

  return { isValid: true, sanitizedValue: file };
}

// ========================================
// LOCATION VALIDATION
// ========================================

interface LocationData {
  latitude?: number;
  longitude?: number;
  address?: string;
}

/**
 * Validates location data
 */
export function validateLocation(location: LocationData | string): ValidationResult {
  if (!location) {
    return { isValid: false, error: 'Location is required' };
  }

  // If string (address), validate as address
  if (typeof location === 'string') {
    return validateAddress(location);
  }

  // If coordinates
  if (location.latitude !== undefined && location.longitude !== undefined) {
    if (location.latitude < -90 || location.latitude > 90) {
      return { isValid: false, error: 'Invalid latitude' };
    }
    if (location.longitude < -180 || location.longitude > 180) {
      return { isValid: false, error: 'Invalid longitude' };
    }
    return { isValid: true, sanitizedValue: location };
  }

  // If address
  if (location.address) {
    return validateAddress(location.address);
  }

  return { isValid: false, error: 'Please provide location coordinates or an address' };
}

// ========================================
// GENERIC VALIDATION
// ========================================

interface GenericValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  customValidator?: (value: any) => boolean | string;
}

/**
 * Generic validation function
 */
export function validate(value: any, options: GenericValidationOptions = {}): ValidationResult {
  const { required = false, minLength, maxLength, pattern, customValidator } = options;

  // Required check
  if (required && (value === null || value === undefined || value === '')) {
    return { isValid: false, error: 'This field is required' };
  }

  // If not required and empty, it's valid
  if (!required && (value === null || value === undefined || value === '')) {
    return { isValid: true, sanitizedValue: value };
  }

  const stringValue = String(value);

  // Min length
  if (minLength !== undefined && stringValue.length < minLength) {
    return { isValid: false, error: `Must be at least ${minLength} characters` };
  }

  // Max length
  if (maxLength !== undefined && stringValue.length > maxLength) {
    return { isValid: false, error: `Must be at most ${maxLength} characters` };
  }

  // Pattern
  if (pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    if (!regex.test(stringValue)) {
      return { isValid: false, error: 'Invalid format' };
    }
  }

  // Custom validator
  if (customValidator) {
    const result = customValidator(value);
    if (result !== true) {
      return { isValid: false, error: typeof result === 'string' ? result : 'Invalid value' };
    }
  }

  return { isValid: true, sanitizedValue: value };
}

// ========================================
// VALIDATION BY TYPE
// ========================================

type ValidationType =
  | 'email'
  | 'phone'
  | 'name'
  | 'number'
  | 'url'
  | 'date'
  | 'address'
  | 'file'
  | 'location'
  | 'text';

/**
 * Validates a value based on type
 */
export function validateByType(
  type: ValidationType,
  value: any,
  options?: any
): ValidationResult {
  switch (type) {
    case 'email':
      return validateEmail(value);
    case 'phone':
      return validatePhone(value);
    case 'name':
      return validateName(value, options?.minLength);
    case 'number':
      return validateNumber(value, options);
    case 'url':
      return validateUrl(value, options?.requireProtocol);
    case 'date':
      return validateDate(value, options);
    case 'address':
      return validateAddress(value);
    case 'file':
      return validateFile(value, options);
    case 'location':
      return validateLocation(value);
    case 'text':
    default:
      return validate(value, options);
  }
}

export default {
  validateEmail,
  validatePhone,
  validateName,
  validateNumber,
  validateUrl,
  validateDate,
  validateAddress,
  validateFile,
  validateLocation,
  validate,
  validateByType,
};
