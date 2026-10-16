/**
 * OtpStep.tsx
 *
 * otp-node (web richNodesView renderOtp): first the e-mail ("We'll email
 * you a 6-digit code.", Send code), then the six digit boxes with Verify,
 * "Resend code" once its wait is over, "Change email" and, when the step
 * allows it, Skip. Answers: {action: "send", email}, {action: "verify",
 * code}, {action: "resend"}, {action: "skip"}. The step's own words for a
 * refused answer show under the field. The composer still takes a typed
 * e-mail or code too.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { digitsFromPaste, maskEmail, OTP_LENGTH, resendLabel } from '../../../core/flow/rich';
import { t } from '../../../core/i18n';
import { StepButton, StepCard, StepField, StepLink, StepRow, StepStatus, StepViewProps, useStepLook } from './stepKit';

/** Seconds until Resend opens: the step's wait from when the code was sent. */
export const resendSecondsLeft = (sentAt: any, resendIn: any, now: number): number => {
  const at = Number(sentAt);
  const wait = Number(resendIn);
  if (!Number.isFinite(at) || at <= 0 || !Number.isFinite(wait)) return 0;
  return Math.max(0, Math.ceil((at + wait * 1000 - now) / 1000));
};

export const OtpStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-otp' }) => {
  const look = useStepLook();
  const codeStage = ui.stage === 'code';
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<TextInput>(null);

  // A new code (sent or re-sent): fresh boxes, back from "Change email".
  useEffect(() => {
    setChanging(false);
    setCode('');
  }, [ui.sentAt]);

  const left = codeStage ? resendSecondsLeft(ui.sentAt, ui.resendIn, now) : 0;
  const ticking = codeStage && left > 0;
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const skip = ui.allowSkip ? (
    <StepButton look={look} title={ui.skipLabel || t('common.skip')} disabled={busy} onPress={() => onSubmit({ action: 'skip' })} testID={`${testID}-skip`} />
  ) : null;

  if (!codeStage || changing) {
    const send = () => onSubmit({ action: 'send', email: email.trim() });
    return (
      <StepCard look={look} testID={testID}>
        <StepField
          look={look}
          label={t('otp.emailLabel')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('otp.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={send}
          editable={!busy}
          testID={`${testID}-email`}
        />
        <StepStatus look={look} error={changing ? undefined : ui.errorMessage} hint={t('otp.willEmail', { n: OTP_LENGTH })} testID={`${testID}-status`} />
        <StepRow end>
          {skip}
          <StepButton look={look} primary title={t('otp.send')} disabled={busy} onPress={send} testID={`${testID}-send`} />
        </StepRow>
      </StepCard>
    );
  }

  const digits = code.padEnd(OTP_LENGTH, ' ').slice(0, OTP_LENGTH).split('');
  const verify = () => onSubmit({ action: 'verify', code });
  return (
    <StepCard look={look} testID={testID}>
      <Text style={{ color: look.text, fontSize: look.fontSize }}>
        {t('otp.sentTo', { n: OTP_LENGTH, email: maskEmail(ui.sentTo) })}
      </Text>
      {/* Six boxes over one field: typing, pasting and the keyboard's suggested code all land here. */}
      <TouchableOpacity activeOpacity={1} onPress={() => codeRef.current?.focus()} accessible={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {digits.map((d, i) => (
            <View
              key={i}
              style={{
                width: 40,
                height: 46,
                borderRadius: Math.min(look.radius, 10),
                borderWidth: 1,
                borderColor: i === Math.min(code.length, OTP_LENGTH - 1) ? look.accent : look.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: look.text, fontSize: look.fontSize + 4, fontWeight: '600' }}>{d.trim()}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={codeRef}
          value={code}
          onChangeText={(v) => setCode(digitsFromPaste(v))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          autoFocus
          editable={!busy}
          onSubmitEditing={verify}
          caretHidden
          accessibilityLabel={t('sdk.otp.code', { n: OTP_LENGTH })}
          testID={`${testID}-code`}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' }}
        />
      </TouchableOpacity>
      <StepStatus look={look} error={ui.errorMessage} testID={`${testID}-status`} />
      <StepRow>
        <StepLink look={look} title={resendLabel(left)} disabled={busy || left > 0} onPress={() => onSubmit({ action: 'resend' })} testID={`${testID}-resend`} />
        <Text style={{ color: look.muted }}>·</Text>
        <StepLink
          look={look}
          title={t('otp.changeEmail')}
          disabled={busy}
          onPress={() => {
            setEmail(String(ui.sentTo || ''));
            setChanging(true);
          }}
          testID={`${testID}-change`}
        />
      </StepRow>
      <StepRow end>
        {skip}
        <StepButton look={look} primary title={t('otp.verify')} disabled={busy} onPress={verify} testID={`${testID}-verify`} />
      </StepRow>
    </StepCard>
  );
};

export default OtpStep;
