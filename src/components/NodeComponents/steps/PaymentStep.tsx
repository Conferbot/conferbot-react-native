/**
 * PaymentStep.tsx
 *
 * payment-node (web richNodesView renderPayment): Pay now (with the
 * amount) opens the secure Stripe Checkout in the browser and answers
 * {action: "open"}; once it is open, "I've paid" asks the server
 * ({action: "check"}); Cancel answers {action: "cancel"}. The time left
 * shows under the buttons. The step itself watches for the payment.
 */

import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { isCheckoutUrl, paymentCountdown } from '../../../core/flow/rich';
import { StepButton, StepCard, StepRow, StepStatus, StepViewProps, useStepLook } from './stepKit';
import { t } from '../../../core/i18n';

/** "12:05 left" until the step times out, or nothing. */
export const paymentTimeLeft = (expiresAt: any, now: number): string => {
  const at = Number(expiresAt);
  if (!Number.isFinite(at) || at <= 0) return '';
  const left = at - now;
  return left > 0 ? t('sdk.pay.timeLeft', { time: paymentCountdown(left) }) : '';
};

export const PaymentStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-payment' }) => {
  const look = useStepLook();
  const [now, setNow] = useState(() => Date.now());
  const buttons: any[] = ui.buttons || [];
  const url = String(ui.checkoutUrl || buttons.find((b) => b.id === 'open')?.value || '');

  useEffect(() => {
    if (!ui.expiresAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ui.expiresAt]);

  return (
    <StepCard look={look} testID={testID}>
      <StepRow>
        {buttons.map((b) =>
          b.id === 'open' ? (
            <StepButton
              key={b.id}
              look={look}
              primary
              title={b.label}
              disabled={busy || !isCheckoutUrl(url)}
              onPress={() => {
                Linking.openURL(url).catch(() => undefined);
                onSubmit({ action: 'open' });
              }}
              testID={`${testID}-open`}
            />
          ) : (
            <StepButton key={b.id} look={look} title={b.label} disabled={busy} onPress={() => onSubmit({ action: b.id })} testID={`${testID}-${b.id}`} />
          )
        )}
      </StepRow>
      <StepStatus look={look} error={ui.errorMessage} hint={paymentTimeLeft(ui.expiresAt, now)} testID={`${testID}-status`} />
    </StepCard>
  );
};

export default PaymentStep;
