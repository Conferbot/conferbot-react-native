/**
 * ValidationUtils Tests
 *
 * Comprehensive tests for all validation functions.
 * Covers email, phone, URL, date, name, number, file,
 * location, and generic validation.
 */

import {
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
} from '../../src/core/utils/ValidationUtils';

import {
  validEmails,
  invalidEmails,
  validPhones,
  invalidPhones,
  validUrls,
  invalidUrls,
} from '../testUtils';

// ========================================
// EMAIL VALIDATION TESTS
// ========================================

describe('validateEmail', () => {
  describe('valid emails', () => {
    test.each(validEmails)('should validate "%s" as valid', (email) => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.sanitizedValue).toBe(email.trim().toLowerCase());
    });

    it('should handle email with uppercase and trim whitespace', () => {
      const result = validateEmail('  Test@Example.COM  ');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('test@example.com');
    });
  });

  describe('invalid emails', () => {
    test.each(invalidEmails)('should reject "%s" as invalid', (email) => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty string with required error', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject whitespace-only input', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });
  });
});

// ========================================
// PHONE VALIDATION TESTS
// ========================================

describe('validatePhone', () => {
  describe('valid phone numbers', () => {
    test.each(validPhones)('should validate "%s" as valid', (phone) => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should preserve formatting in sanitized value', () => {
      const result = validatePhone('+1 (555) 123-4567');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('+1 (555) 123-4567');
    });
  });

  describe('invalid phone numbers', () => {
    test.each(invalidPhones)('should reject "%s" as invalid', (phone) => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty string with required error', () => {
      const result = validatePhone('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number is required');
    });

    it('should reject phone with less than 7 digits', () => {
      const result = validatePhone('123456');
      expect(result.isValid).toBe(false);
    });

    it('should reject phone with more than 15 digits', () => {
      const result = validatePhone('1234567890123456');
      expect(result.isValid).toBe(false);
    });
  });
});

// ========================================
// NAME VALIDATION TESTS
// ========================================

describe('validateName', () => {
  it('should validate a simple name', () => {
    const result = validateName('John');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('John');
  });

  it('should validate name with spaces', () => {
    const result = validateName('John Doe');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('John Doe');
  });

  it('should trim whitespace', () => {
    const result = validateName('  John Doe  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('John Doe');
  });

  it('should reject empty string', () => {
    const result = validateName('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Name is required');
  });

  it('should reject name shorter than minLength', () => {
    const result = validateName('Jo', 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least 3 characters');
  });

  it('should reject name longer than 100 characters', () => {
    const longName = 'A'.repeat(101);
    const result = validateName(longName);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Name is too long');
  });
});

// ========================================
// NUMBER VALIDATION TESTS
// ========================================

describe('validateNumber', () => {
  it('should validate a string number', () => {
    const result = validateNumber('42');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(42);
  });

  it('should validate a numeric value', () => {
    const result = validateNumber(3.14);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(3.14);
  });

  it('should validate negative numbers', () => {
    const result = validateNumber('-5');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(-5);
  });

  it('should reject non-numeric string', () => {
    const result = validateNumber('not a number');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Please enter a valid number');
  });

  it('should validate with min constraint', () => {
    expect(validateNumber('5', { min: 0 }).isValid).toBe(true);
    expect(validateNumber('-1', { min: 0 }).isValid).toBe(false);
    expect(validateNumber('-1', { min: 0 }).error).toContain('at least 0');
  });

  it('should validate with max constraint', () => {
    expect(validateNumber('50', { max: 100 }).isValid).toBe(true);
    expect(validateNumber('150', { max: 100 }).isValid).toBe(false);
    expect(validateNumber('150', { max: 100 }).error).toContain('at most 100');
  });

  it('should validate integer constraint', () => {
    expect(validateNumber('5', { integer: true }).isValid).toBe(true);
    expect(validateNumber('5.5', { integer: true }).isValid).toBe(false);
    expect(validateNumber('5.5', { integer: true }).error).toBe('Please enter a whole number');
  });

  it('should allow empty when not required', () => {
    const result = validateNumber('', { required: false });
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBeNull();
  });

  it('should reject empty when required', () => {
    const result = validateNumber('', { required: true });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('A number is required');
  });
});

// ========================================
// URL VALIDATION TESTS
// ========================================

describe('validateUrl', () => {
  describe('valid URLs', () => {
    test.each(validUrls)('should validate "%s" as valid', (url) => {
      const result = validateUrl(url);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid URLs', () => {
    test.each(invalidUrls)('should reject "%s" as invalid', (url) => {
      const result = validateUrl(url);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should add https:// prefix when missing', () => {
    const result = validateUrl('example.com');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('https://example.com');
  });

  it('should preserve existing http:// protocol', () => {
    const result = validateUrl('http://example.com');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('http://example.com');
  });

  it('should require protocol when specified', () => {
    const result = validateUrl('example.com', true);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('must start with http');
  });

  it('should trim whitespace', () => {
    const result = validateUrl('  https://example.com  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('https://example.com');
  });
});

// ========================================
// DATE VALIDATION TESTS
// ========================================

describe('validateDate', () => {
  it('should validate a valid date string', () => {
    const result = validateDate('2024-01-15');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBeDefined();
  });

  it('should validate a Date object', () => {
    const date = new Date('2024-01-15');
    const result = validateDate(date);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid date string', () => {
    const result = validateDate('not-a-date');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Please enter a valid date');
  });

  it('should reject empty value', () => {
    const result = validateDate('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Date is required');
  });

  it('should validate with minDate constraint', () => {
    const minDate = new Date('2024-01-01');
    expect(validateDate('2024-02-01', { minDate }).isValid).toBe(true);
    expect(validateDate('2023-12-01', { minDate }).isValid).toBe(false);
  });

  it('should validate with maxDate constraint', () => {
    const maxDate = new Date('2024-12-31');
    expect(validateDate('2024-06-15', { maxDate }).isValid).toBe(true);
    expect(validateDate('2025-01-01', { maxDate }).isValid).toBe(false);
  });

  it('should accept minDate and maxDate as strings', () => {
    const result = validateDate('2024-06-15', {
      minDate: '2024-01-01',
      maxDate: '2024-12-31',
    });
    expect(result.isValid).toBe(true);
  });

  it('should return ISO string as sanitized value', () => {
    const result = validateDate('2024-01-15');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toContain('2024-01-15');
  });
});

// ========================================
// ADDRESS VALIDATION TESTS
// ========================================

describe('validateAddress', () => {
  it('should validate a valid address', () => {
    const result = validateAddress('123 Main Street, City, State 12345');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('123 Main Street, City, State 12345');
  });

  it('should trim whitespace', () => {
    const result = validateAddress('  123 Main Street  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('123 Main Street');
  });

  it('should reject empty string', () => {
    const result = validateAddress('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Address is required');
  });

  it('should reject address shorter than 5 characters', () => {
    const result = validateAddress('Main');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Please enter a complete address');
  });

  it('should reject address longer than 500 characters', () => {
    const longAddress = 'A'.repeat(501);
    const result = validateAddress(longAddress);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Address is too long');
  });
});

// ========================================
// FILE VALIDATION TESTS
// ========================================

describe('validateFile', () => {
  const createMockFile = (name: string, size: number, type: string) => ({
    name,
    size,
    type,
  });

  it('should validate a valid file', () => {
    const file = createMockFile('document.pdf', 1024, 'application/pdf');
    const result = validateFile(file);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toEqual(file);
  });

  it('should reject null file when required', () => {
    const result = validateFile(null, { required: true });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Please select a file');
  });

  it('should accept null file when not required', () => {
    const result = validateFile(null, { required: false });
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBeNull();
  });

  it('should reject file exceeding maxSize', () => {
    const file = createMockFile('large.pdf', 10 * 1024 * 1024, 'application/pdf'); // 10MB
    const result = validateFile(file, { maxSize: 5 * 1024 * 1024 }); // 5MB limit
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('less than 5.0MB');
  });

  it('should validate accepted file types by extension', () => {
    const file = createMockFile('image.jpg', 1024, 'image/jpeg');
    const result = validateFile(file, { acceptedTypes: ['jpg', 'png'] });
    expect(result.isValid).toBe(true);
  });

  it('should validate accepted file types by MIME type', () => {
    const file = createMockFile('image.jpg', 1024, 'image/jpeg');
    const result = validateFile(file, { acceptedTypes: ['image/jpeg'] });
    expect(result.isValid).toBe(true);
  });

  it('should reject file with unaccepted type', () => {
    const file = createMockFile('document.exe', 1024, 'application/x-executable');
    const result = validateFile(file, { acceptedTypes: ['pdf', 'jpg', 'png'] });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Accepted file types');
  });
});

// ========================================
// LOCATION VALIDATION TESTS
// ========================================

describe('validateLocation', () => {
  it('should validate string address', () => {
    const result = validateLocation('123 Main Street, City');
    expect(result.isValid).toBe(true);
  });

  it('should validate coordinates object', () => {
    const result = validateLocation({ latitude: 40.7128, longitude: -74.0060 });
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toEqual({ latitude: 40.7128, longitude: -74.0060 });
  });

  it('should validate location object with address', () => {
    const result = validateLocation({ address: '123 Main Street, City' });
    expect(result.isValid).toBe(true);
  });

  it('should reject empty value', () => {
    const result = validateLocation('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Location is required');
  });

  it('should reject null value', () => {
    const result = validateLocation(null as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Location is required');
  });

  it('should reject invalid latitude', () => {
    const result = validateLocation({ latitude: 100, longitude: 0 });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid latitude');
  });

  it('should reject invalid longitude', () => {
    const result = validateLocation({ latitude: 0, longitude: 200 });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid longitude');
  });

  it('should validate edge case coordinates', () => {
    // Valid extremes
    expect(validateLocation({ latitude: 90, longitude: 180 }).isValid).toBe(true);
    expect(validateLocation({ latitude: -90, longitude: -180 }).isValid).toBe(true);
  });

  it('should reject location object without coordinates or address', () => {
    const result = validateLocation({ someOtherField: 'value' } as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('provide location coordinates or an address');
  });
});

// ========================================
// GENERIC VALIDATION TESTS
// ========================================

describe('validate (generic)', () => {
  it('should pass for any value when no options', () => {
    expect(validate('anything').isValid).toBe(true);
    expect(validate(123).isValid).toBe(true);
    expect(validate({ key: 'value' }).isValid).toBe(true);
  });

  it('should validate required field', () => {
    expect(validate('value', { required: true }).isValid).toBe(true);
    expect(validate('', { required: true }).isValid).toBe(false);
    expect(validate(null, { required: true }).isValid).toBe(false);
    expect(validate(undefined, { required: true }).isValid).toBe(false);
  });

  it('should allow empty when not required', () => {
    expect(validate('', { required: false }).isValid).toBe(true);
    expect(validate(null, { required: false }).isValid).toBe(true);
  });

  it('should validate minLength', () => {
    expect(validate('hello', { minLength: 3 }).isValid).toBe(true);
    expect(validate('hi', { minLength: 3 }).isValid).toBe(false);
    expect(validate('hi', { minLength: 3 }).error).toContain('at least 3 characters');
  });

  it('should validate maxLength', () => {
    expect(validate('hi', { maxLength: 5 }).isValid).toBe(true);
    expect(validate('hello world', { maxLength: 5 }).isValid).toBe(false);
    expect(validate('hello world', { maxLength: 5 }).error).toContain('at most 5 characters');
  });

  it('should validate with RegExp pattern', () => {
    const pattern = /^[a-z]+$/;
    expect(validate('hello', { pattern }).isValid).toBe(true);
    expect(validate('Hello', { pattern }).isValid).toBe(false);
    expect(validate('Hello', { pattern }).error).toBe('Invalid format');
  });

  it('should validate with string pattern', () => {
    expect(validate('abc123', { pattern: '^[a-z0-9]+$' }).isValid).toBe(true);
    expect(validate('ABC!', { pattern: '^[a-z0-9]+$' }).isValid).toBe(false);
  });

  it('should use custom validator function', () => {
    const customValidator = (value: any) => value > 10 || 'Must be greater than 10';

    expect(validate(15, { customValidator }).isValid).toBe(true);
    expect(validate(5, { customValidator }).isValid).toBe(false);
    expect(validate(5, { customValidator }).error).toBe('Must be greater than 10');
  });

  it('should handle custom validator returning false', () => {
    const customValidator = (value: any) => value === 'valid';

    expect(validate('valid', { customValidator }).isValid).toBe(true);
    expect(validate('invalid', { customValidator }).isValid).toBe(false);
    expect(validate('invalid', { customValidator }).error).toBe('Invalid value');
  });

  it('should combine multiple validation options', () => {
    const options = {
      required: true,
      minLength: 3,
      maxLength: 10,
      pattern: /^[a-z]+$/,
    };

    expect(validate('hello', options).isValid).toBe(true);
    expect(validate('', options).isValid).toBe(false); // required
    expect(validate('hi', options).isValid).toBe(false); // minLength
    expect(validate('verylongvalue', options).isValid).toBe(false); // maxLength
    expect(validate('Hello', options).isValid).toBe(false); // pattern
  });
});

// ========================================
// VALIDATE BY TYPE TESTS
// ========================================

describe('validateByType', () => {
  it('should route to email validation', () => {
    expect(validateByType('email', 'test@example.com').isValid).toBe(true);
    expect(validateByType('email', 'invalid').isValid).toBe(false);
  });

  it('should route to phone validation', () => {
    expect(validateByType('phone', '+1234567890').isValid).toBe(true);
    expect(validateByType('phone', 'abc').isValid).toBe(false);
  });

  it('should route to name validation with options', () => {
    expect(validateByType('name', 'John', { minLength: 2 }).isValid).toBe(true);
    expect(validateByType('name', 'J', { minLength: 2 }).isValid).toBe(false);
  });

  it('should route to number validation with options', () => {
    expect(validateByType('number', '42', { min: 0, max: 100 }).isValid).toBe(true);
    expect(validateByType('number', '200', { max: 100 }).isValid).toBe(false);
  });

  it('should route to url validation with options', () => {
    expect(validateByType('url', 'example.com').isValid).toBe(true);
    expect(validateByType('url', 'example.com', { requireProtocol: true }).isValid).toBe(false);
  });

  it('should route to date validation with options', () => {
    expect(validateByType('date', '2024-06-15').isValid).toBe(true);
    expect(validateByType('date', 'invalid').isValid).toBe(false);
  });

  it('should route to address validation', () => {
    expect(validateByType('address', '123 Main Street').isValid).toBe(true);
    expect(validateByType('address', '').isValid).toBe(false);
  });

  it('should route to file validation', () => {
    const file = { name: 'test.pdf', size: 1024, type: 'application/pdf' };
    expect(validateByType('file', file).isValid).toBe(true);
    expect(validateByType('file', null).isValid).toBe(false);
  });

  it('should route to location validation', () => {
    expect(validateByType('location', { latitude: 40, longitude: -74 }).isValid).toBe(true);
    expect(validateByType('location', null).isValid).toBe(false);
  });

  it('should route to generic validation for text type', () => {
    expect(validateByType('text', 'any value', { required: true }).isValid).toBe(true);
    expect(validateByType('text', '', { required: true }).isValid).toBe(false);
  });

  it('should use generic validation as default', () => {
    expect(validateByType('unknown' as any, 'value').isValid).toBe(true);
  });
});
