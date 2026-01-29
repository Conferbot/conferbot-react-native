/**
 * Message Status Utility Tests
 *
 * Tests for message status helper functions used in read receipts.
 */

import {
  MessageStatus,
  isStatusFinal,
  isStatusMoreAdvanced,
  getNextStatus,
  DEFAULT_READ_RECEIPT_CONFIG,
} from '../../src/types/messageStatus';

describe('MessageStatus', () => {
  // ========================================
  // ENUM VALUES
  // ========================================

  describe('Enum Values', () => {
    it('should have correct status values', () => {
      expect(MessageStatus.SENDING).toBe('sending');
      expect(MessageStatus.SENT).toBe('sent');
      expect(MessageStatus.DELIVERED).toBe('delivered');
      expect(MessageStatus.READ).toBe('read');
    });
  });

  // ========================================
  // isStatusFinal TESTS
  // ========================================

  describe('isStatusFinal', () => {
    it('should return false for SENDING status', () => {
      expect(isStatusFinal(MessageStatus.SENDING)).toBe(false);
    });

    it('should return false for SENT status', () => {
      expect(isStatusFinal(MessageStatus.SENT)).toBe(false);
    });

    it('should return true for DELIVERED status', () => {
      expect(isStatusFinal(MessageStatus.DELIVERED)).toBe(true);
    });

    it('should return true for READ status', () => {
      expect(isStatusFinal(MessageStatus.READ)).toBe(true);
    });
  });

  // ========================================
  // isStatusMoreAdvanced TESTS
  // ========================================

  describe('isStatusMoreAdvanced', () => {
    describe('SENDING comparisons', () => {
      it('should return false when comparing SENDING to SENDING', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENDING, MessageStatus.SENDING)).toBe(false);
      });

      it('should return false when comparing SENDING to SENT', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENDING, MessageStatus.SENT)).toBe(false);
      });

      it('should return false when comparing SENDING to DELIVERED', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENDING, MessageStatus.DELIVERED)).toBe(false);
      });

      it('should return false when comparing SENDING to READ', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENDING, MessageStatus.READ)).toBe(false);
      });
    });

    describe('SENT comparisons', () => {
      it('should return true when comparing SENT to SENDING', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENT, MessageStatus.SENDING)).toBe(true);
      });

      it('should return false when comparing SENT to SENT', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENT, MessageStatus.SENT)).toBe(false);
      });

      it('should return false when comparing SENT to DELIVERED', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENT, MessageStatus.DELIVERED)).toBe(false);
      });

      it('should return false when comparing SENT to READ', () => {
        expect(isStatusMoreAdvanced(MessageStatus.SENT, MessageStatus.READ)).toBe(false);
      });
    });

    describe('DELIVERED comparisons', () => {
      it('should return true when comparing DELIVERED to SENDING', () => {
        expect(isStatusMoreAdvanced(MessageStatus.DELIVERED, MessageStatus.SENDING)).toBe(true);
      });

      it('should return true when comparing DELIVERED to SENT', () => {
        expect(isStatusMoreAdvanced(MessageStatus.DELIVERED, MessageStatus.SENT)).toBe(true);
      });

      it('should return false when comparing DELIVERED to DELIVERED', () => {
        expect(isStatusMoreAdvanced(MessageStatus.DELIVERED, MessageStatus.DELIVERED)).toBe(false);
      });

      it('should return false when comparing DELIVERED to READ', () => {
        expect(isStatusMoreAdvanced(MessageStatus.DELIVERED, MessageStatus.READ)).toBe(false);
      });
    });

    describe('READ comparisons', () => {
      it('should return true when comparing READ to SENDING', () => {
        expect(isStatusMoreAdvanced(MessageStatus.READ, MessageStatus.SENDING)).toBe(true);
      });

      it('should return true when comparing READ to SENT', () => {
        expect(isStatusMoreAdvanced(MessageStatus.READ, MessageStatus.SENT)).toBe(true);
      });

      it('should return true when comparing READ to DELIVERED', () => {
        expect(isStatusMoreAdvanced(MessageStatus.READ, MessageStatus.DELIVERED)).toBe(true);
      });

      it('should return false when comparing READ to READ', () => {
        expect(isStatusMoreAdvanced(MessageStatus.READ, MessageStatus.READ)).toBe(false);
      });
    });
  });

  // ========================================
  // getNextStatus TESTS
  // ========================================

  describe('getNextStatus', () => {
    it('should return SENT for SENDING', () => {
      expect(getNextStatus(MessageStatus.SENDING)).toBe(MessageStatus.SENT);
    });

    it('should return DELIVERED for SENT', () => {
      expect(getNextStatus(MessageStatus.SENT)).toBe(MessageStatus.DELIVERED);
    });

    it('should return READ for DELIVERED', () => {
      expect(getNextStatus(MessageStatus.DELIVERED)).toBe(MessageStatus.READ);
    });

    it('should return null for READ (terminal state)', () => {
      expect(getNextStatus(MessageStatus.READ)).toBeNull();
    });
  });

  // ========================================
  // DEFAULT CONFIG TESTS
  // ========================================

  describe('DEFAULT_READ_RECEIPT_CONFIG', () => {
    it('should have enabled set to true', () => {
      expect(DEFAULT_READ_RECEIPT_CONFIG.enabled).toBe(true);
    });

    it('should have showIndicators set to true', () => {
      expect(DEFAULT_READ_RECEIPT_CONFIG.showIndicators).toBe(true);
    });

    it('should have batchDebounceMs set to 500', () => {
      expect(DEFAULT_READ_RECEIPT_CONFIG.batchDebounceMs).toBe(500);
    });

    it('should have autoMarkAsRead set to true', () => {
      expect(DEFAULT_READ_RECEIPT_CONFIG.autoMarkAsRead).toBe(true);
    });
  });

  // ========================================
  // STATUS PROGRESSION TESTS
  // ========================================

  describe('Status Progression', () => {
    it('should follow correct progression order', () => {
      let current: MessageStatus | null = MessageStatus.SENDING;
      const progression: MessageStatus[] = [];

      while (current !== null) {
        progression.push(current);
        current = getNextStatus(current);
      }

      expect(progression).toEqual([
        MessageStatus.SENDING,
        MessageStatus.SENT,
        MessageStatus.DELIVERED,
        MessageStatus.READ,
      ]);
    });

    it('should not allow going backwards in progression', () => {
      // Once READ, cannot go back to DELIVERED
      expect(isStatusMoreAdvanced(MessageStatus.DELIVERED, MessageStatus.READ)).toBe(false);

      // Once DELIVERED, cannot go back to SENT
      expect(isStatusMoreAdvanced(MessageStatus.SENT, MessageStatus.DELIVERED)).toBe(false);
    });
  });
});
