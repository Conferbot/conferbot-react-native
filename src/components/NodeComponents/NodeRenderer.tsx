/**
 * NodeRenderer.tsx
 *
 * Main component that renders the appropriate UI based on NodeUIState type.
 * Acts as a router to render the correct component for each node type.
 */

import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';
import ConferBotContext from '../../context/ConferBotContext';
import { HandoverWaitCard } from '../LiveChat/LiveChatCards';

import {
  MessageBubble,
  ImageDisplay,
  VideoPlayer,
  AudioPlayer,
  FileDownload,
  HTMLView,
} from './MessageComponents';
import { t } from '../../core/i18n';
import { TextInputComponent } from './InputComponents';
import {
  ButtonGroup,
  CardGrid,
  CarouselView,
  PictureChoiceGrid,
  DropdownPicker,
} from './SelectionComponents';
import {
  StarRating,
  OpinionScaleSelector,
  SliderInput,
} from './RatingComponents';
import {
  CalendarPicker,
  MultiFieldForm,
  FileUploadButton,
  LocationInput,
} from './AdvancedComponents';
import {
  HumanHandoverView,
  GPTResponseView,
  LoadingIndicator,
  QuizQuestion,
} from './SpecialComponents';
import { stepViewFor } from './steps';

/**
 * Props for the NodeRenderer component
 */
export interface NodeRendererProps {
  /** The UI state to render */
  uiState: NodeUIState | null;
  /** Callback when user submits a response */
  onSubmit: (response: any, portName?: string) => void;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Whether this is a bot message (affects styling) */
  isBot?: boolean;
  /** Optional custom component renderer for 'custom' type nodes */
  customRenderer?: (
    componentName: string,
    props: Record<string, any>,
    onSubmit: (response: any, portName?: string) => void
  ) => React.ReactNode;
}

/**
 * NodeRenderer component
 *
 * Renders the appropriate UI component based on the NodeUIState type.
 * This is the main entry point for rendering node UI in the chat.
 */
export const NodeRenderer: React.FC<NodeRendererProps> = ({
  uiState,
  onSubmit,
  isLoading = false,
  isBot = true,
  customRenderer,
}) => {
  const theme = useTheme();
  // Optional: the renderer also works standalone (tests, previews).
  const conferBot = useContext(ConferBotContext);

  if (!uiState) {
    return null;
  }

  // A step with its own card (consent, OTP, address, signature, ranking,
  // matrix, payment, slider, date / time, cards, pictures): the card stays
  // while its answer is on the way, so what was typed or moved is kept.
  const Step = stepViewFor(uiState);
  if (Step) {
    return <Step key={uiState.nodeId} ui={uiState} onSubmit={onSubmit} busy={isLoading} />;
  }

  // If loading, show loading indicator
  if (isLoading && uiState.type !== 'loading') {
    return (
      <LoadingIndicator
        nodeId={uiState.nodeId}
        type="loading"
        message={t('sdk.loading.processing')}
      />
    );
  }

  // Render based on UI state type
  switch (uiState.type) {
    // Message components
    case 'message':
      return <MessageBubble {...uiState} isBot={isBot} />;

    case 'image':
      return <ImageDisplay {...uiState} />;

    case 'video':
      return <VideoPlayer {...uiState} />;

    case 'audio':
      return <AudioPlayer {...uiState} />;

    case 'file':
      return <FileDownload {...uiState} />;

    case 'html':
      return <HTMLView {...uiState} />;

    // Input components
    case 'textInput':
      return <TextInputComponent {...uiState} onSubmit={onSubmit} />;

    // Selection components
    case 'buttons':
      return <ButtonGroup {...uiState} onSubmit={onSubmit} />;

    case 'cards':
      return <CardGrid {...uiState} onSubmit={onSubmit} />;

    case 'carousel':
      return <CarouselView {...uiState} onSubmit={onSubmit} />;

    case 'pictureChoice':
      return <PictureChoiceGrid {...uiState} onSubmit={onSubmit} />;

    case 'dropdown':
      return <DropdownPicker {...uiState} onSubmit={onSubmit} />;

    // Rating components
    case 'rating':
      return <StarRating {...uiState} onSubmit={onSubmit} />;

    case 'opinionScale':
      return <OpinionScaleSelector {...uiState} onSubmit={onSubmit} />;

    case 'slider':
      return <SliderInput {...uiState} onSubmit={onSubmit} />;

    // Advanced components
    case 'calendar':
      return <CalendarPicker {...uiState} onSubmit={onSubmit} />;

    case 'multipleQuestions':
      return <MultiFieldForm {...uiState} onSubmit={onSubmit} />;

    case 'fileUpload':
      return <FileUploadButton {...uiState} onSubmit={onSubmit} />;

    case 'locationPicker':
      return <LocationInput {...uiState} onSubmit={onSubmit} />;

    // Special components
    case 'humanHandover':
      // Waiting for a person: the compact card with their place in line
      // (the handover message is already in the chat above it).
      if (uiState.stage === 'waiting' && !uiState.showPreChatForm && conferBot) {
        // Cancel leaves the queue on the server too (queue-self-resolve),
        // then the flow carries on.
        return (
          <HandoverWaitCard
            onCancel={() => (conferBot.leaveQueue ? conferBot.leaveQueue() : onSubmit({ action: 'cancel' }))}
          />
        );
      }
      return <HumanHandoverView {...uiState} onSubmit={onSubmit} />;

    case 'gptResponse':
      return <GPTResponseView {...uiState} />;

    case 'loading':
      return <LoadingIndicator {...uiState} />;

    case 'quiz':
      return <QuizQuestion {...uiState} onSubmit={onSubmit} />;

    // Custom component
    case 'custom':
      if (customRenderer) {
        return (
          <View style={styles.customContainer}>
            {customRenderer(uiState.componentName, uiState.props, onSubmit)}
          </View>
        );
      }
      // Fallback for custom components without renderer
      return (
        <MessageBubble
          nodeId={uiState.nodeId}
          type="message"
          text={`Custom component: ${uiState.componentName}`}
          isBot={true}
        />
      );

    default:
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustiveCheck: never = uiState;
      console.warn('Unknown UI state type:', (_exhaustiveCheck as any)?.type);
      return null;
  }
};

const styles = StyleSheet.create({
  customContainer: {
    width: '100%',
  },
});

export default NodeRenderer;
