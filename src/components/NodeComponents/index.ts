/**
 * NodeComponents/index.ts
 *
 * Main exports for all node UI components in the Conferbot React Native SDK.
 * These components render the appropriate UI based on NodeUIState types.
 */

// Main renderer
export { NodeRenderer } from './NodeRenderer';
export type { NodeRendererProps } from './NodeRenderer';

// Message components
export {
  MessageBubble,
  ImageDisplay,
  VideoPlayer,
  AudioPlayer,
  FileDownload,
  HTMLView,
} from './MessageComponents';

// Input components
export { TextInputField, TextInputComponent } from './InputComponents';

// Selection components
export {
  ButtonGroup,
  CardGrid,
  CarouselView,
  PictureChoiceGrid,
  DropdownPicker,
} from './SelectionComponents';

// Rating components
export {
  StarRating,
  OpinionScaleSelector,
  SliderInput,
} from './RatingComponents';

// Advanced components
export {
  CalendarPicker,
  MultiFieldForm,
  FileUploadButton,
  LocationInput,
} from './AdvancedComponents';

// Special components
export {
  HumanHandoverView,
  GPTResponseView,
  LoadingIndicator,
  QuizQuestion,
} from './SpecialComponents';

// The flow steps' own cards (consent, OTP, address, signature, ranking,
// matrix, payment, slider, date / time, cards, pictures) and the router
// NodeRenderer uses, for custom renderers.
export {
  stepViewFor,
  useStepLook,
  ConsentStep,
  PaymentStep,
  RankingStep,
  MatrixStep,
  OtpStep,
  AddressStep,
  SignatureStep,
  SliderStep,
  DateTimeStep,
  CardsStep,
  ImageChoiceStep,
} from './steps';
export type { StepViewProps, StepLook } from './steps';
