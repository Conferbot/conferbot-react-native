/**
 * Masking sensitive details (customizations.redactSensitive), as the web
 * widget's privacy/redact.ts: answers and the visitor's record entries are
 * masked, the transcript keeps what was typed.
 */
import { redactText, maskRecordEntry, maskValue } from '../../src/core/privacy/redact';
import { ChatState } from '../../src/core/state/ChatState';

describe('redactSensitive', () => {
  it('masks card numbers (Luhn), IBANs, ids, passwords, codes and keys - never e-mails or phones', () => {
    expect(redactText('my card 4242 4242 4242 4242 ok')).toEqual({ text: 'my card [card •••• 4242] ok', found: ['card'] });
    expect(redactText('order 4242424242424241').found).toEqual([]);
    expect(redactText('IBAN GB82 WEST 1234 5698 7654 32').text).toBe('IBAN [bank account hidden]');
    expect(redactText('ssn 123-45-6789').text).toBe('ssn [id hidden]');
    expect(redactText('my password is hunter22').text).toBe('my password is [hidden]');
    expect(redactText('the otp 482913').text).toBe('the otp [hidden]');
    expect(redactText('key sk_live_abcdefghijklmnop1234').text).toBe('key [secret key hidden]');
    expect(redactText('ana+4242424242424242@acme.io, +1 555 123 4567').found).toEqual([]);
  });

  it('masks only the visitor\'s own record entries', () => {
    expect(maskRecordEntry({ shape: 'user-ask-custom-question-response', text: '4242424242424242' })).toEqual({
      shape: 'user-ask-custom-question-response',
      text: '[card •••• 4242]',
      redacted: ['card'],
    });
    expect(maskRecordEntry({ type: 'message-node', text: '4242424242424242' }).text).toBe('4242424242424242');
    expect(maskValue(42)).toBe(42);
  });

  it('ChatState masks answers and records unless redactSensitive is false; the transcript is kept', () => {
    const on = new ChatState('s', 'b');
    on.registerAnswerVariable('q', 'note');
    on.setAnswerVariable('q', 'card 4242424242424242');
    on.addRecord({ _id: 'q', id: 'q', shape: 'user-ask-custom-question-response', text: 'card 4242424242424242', time: '' } as any);
    on.addUserMessage('card 4242424242424242', 'q');
    expect(on.getAnswer('note')).toBe('card [card •••• 4242]');
    expect((on.getRecord()[0] as any).text).toBe('card [card •••• 4242]');
    expect(on.getTranscript()[0].text).toBe('card 4242424242424242');

    const off = new ChatState('s', 'b');
    off.setRedactSensitive(false);
    off.saveVariableByName('note', 'card 4242424242424242');
    expect(off.getAnswer('note')).toBe('card 4242424242424242');
  });
});
