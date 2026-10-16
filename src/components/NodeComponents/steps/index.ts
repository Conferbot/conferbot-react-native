/**
 * The flow steps' own cards, as the web widget draws them
 * (richNodesView.ts, displayStep.ts): picked by the step the waiting
 * state belongs to (stepType, stamped by the engine), else by the state.
 * Steps typed in the composer (ask-*, AI, KB) have none.
 */

import type React from 'react';
import type { StepViewProps } from './stepKit';
import { ConsentStep } from './ConsentStep';
import { PaymentStep } from './PaymentStep';
import { RankingStep } from './RankingStep';
import { MatrixStep } from './MatrixStep';
import { OtpStep } from './OtpStep';
import { AddressStep } from './AddressStep';
import { SignatureStep } from './SignatureStep';
import { SliderStep } from './SliderStep';
import { DateTimeStep } from './DateTimeStep';
import { CardsStep } from './CardsStep';
import { ImageChoiceStep } from './ImageChoiceStep';

export type { StepViewProps, StepLook } from './stepKit';
export { useStepLook } from './stepKit';
export { ConsentStep, consentPieces } from './ConsentStep';
export { PaymentStep, paymentTimeLeft } from './PaymentStep';
export { RankingStep, dragTarget } from './RankingStep';
export { MatrixStep, matrixTap, matrixCells } from './MatrixStep';
export { OtpStep, resendSecondsLeft } from './OtpStep';
export { AddressStep } from './AddressStep';
export { SignatureStep, signatureSvg, strokePath } from './SignatureStep';
export { SliderStep, sliderValueAt } from './SliderStep';
export { DateTimeStep, dateTimeValue, hhmm } from './DateTimeStep';
export { CardsStep } from './CardsStep';
export { ImageChoiceStep } from './ImageChoiceStep';

const BY_STEP: Record<string, { ui: string; view: React.FC<StepViewProps> }> = {
  'consent-node': { ui: 'buttons', view: ConsentStep },
  'payment-node': { ui: 'buttons', view: PaymentStep },
  'ranking-node': { ui: 'buttons', view: RankingStep },
  'matrix-node': { ui: 'multipleQuestions', view: MatrixStep },
  'otp-node': { ui: 'textInput', view: OtpStep },
  'signature-node': { ui: 'textInput', view: SignatureStep },
  'address-node': { ui: 'locationPicker', view: AddressStep },
  'slider-node': { ui: 'slider', view: SliderStep },
  'datetime-node': { ui: 'calendar', view: DateTimeStep },
};

/** The card for a waiting state, or null when the generic components draw it. */
export const stepViewFor = (ui: any): React.FC<StepViewProps> | null => {
  if (!ui) return null;
  const own = ui.stepType ? BY_STEP[ui.stepType] : undefined;
  if (own && own.ui === ui.type) return own.view;
  if (ui.type === 'carousel') return CardsStep;
  if (ui.type === 'pictureChoice' && !ui.multiSelect) return ImageChoiceStep;
  return null;
};
