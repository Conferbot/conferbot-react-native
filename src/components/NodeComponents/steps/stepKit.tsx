/**
 * stepKit.tsx
 *
 * The pieces every flow-step card is built from (the web widget's rich
 * cards: conferbot-widget/src/ts/chat/richNodesView.ts and its CSS): the
 * card, the filled button, the option button, the quiet link, the field
 * and the status line under it.
 *
 * The look is the bot's, through the theme the provider builds from its
 * customizations (useThemeOverride): options in the option colours, the
 * main button in the bot colour, the option radius and the font size.
 * Nothing moves on its own.
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '../../../theme';

/** What a step view gets: its waiting state (stamped with the step) and where the answer goes. */
export interface StepViewProps {
  ui: any;
  onSubmit: (response: any) => void;
  /** The answer is on its way: the card stays, its buttons wait. */
  busy?: boolean;
  testID?: string;
}

/** The bot's option look, for every step card. */
export interface StepLook {
  option: string;
  optionInk: string;
  accent: string;
  accentInk: string;
  radius: number;
  fontSize: number;
  card: string;
  text: string;
  muted: string;
  line: string;
  error: string;
  /** Left inset: the cards line up with the bot's bubbles, past the avatar. */
  indent: number;
  gutter: number;
}

export const useStepLook = (): StepLook => {
  const theme = useTheme();
  const c = theme.colors;
  return {
    option: c.optionBubble,
    optionInk: c.optionBubbleText,
    accent: c.primary,
    accentInk: c.botBubbleText,
    radius: theme.borderRadius.button,
    fontSize: theme.typography.fontSize.md,
    card: c.surface,
    text: c.text,
    muted: c.textSecondary,
    line: c.border,
    error: c.error,
    indent: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
    gutter: theme.spacing.chatContentPadding,
  };
};

/** The card a step sits on, under the bot's question. */
export const StepCard: React.FC<{ look: StepLook; children: React.ReactNode; testID?: string; style?: ViewStyle }> = ({ look, children, testID, style }) => (
  <View style={{ paddingLeft: look.indent, paddingRight: look.gutter, marginBottom: 8 }} testID={testID}>
    <View
      style={[
        {
          backgroundColor: look.card,
          borderColor: look.line,
          borderWidth: 1,
          borderRadius: Math.max(look.radius, 12),
          padding: 12,
          gap: 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  </View>
);

/** A button: filled in the bot colour (primary) or in the option colours. */
export const StepButton: React.FC<{
  look: StepLook;
  title: string;
  onPress: () => void;
  primary?: boolean;
  picked?: boolean;
  disabled?: boolean;
  leading?: string;
  testID?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}> = ({ look, title, onPress, primary, picked, disabled, leading, testID, accessibilityLabel, style }) => {
  const filled = primary || picked;
  return (
    <TouchableOpacity
      onPress={() => {
        if (!disabled) onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!disabled, selected: !!picked }}
      testID={testID}
      style={[
        {
          backgroundColor: filled ? look.accent : look.option,
          borderRadius: look.radius,
          paddingHorizontal: 14,
          paddingVertical: 10,
          opacity: disabled ? 0.5 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        style,
      ]}
    >
      {leading ? <Text style={{ color: filled ? look.accentInk : look.optionInk, fontSize: look.fontSize }}>{leading}</Text> : null}
      <Text style={{ color: filled ? look.accentInk : look.optionInk, fontSize: look.fontSize, fontWeight: '500' }}>{title}</Text>
    </TouchableOpacity>
  );
};

/** A quiet text button in the accent (Resend code, Change email, Enter it manually). */
export const StepLink: React.FC<{ look: StepLook; title: string; onPress: () => void; disabled?: boolean; testID?: string; accessibilityLabel?: string }> = ({
  look,
  title,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
}) => (
  <TouchableOpacity
    onPress={() => {
      if (!disabled) onPress();
    }}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ disabled: !!disabled }}
    testID={testID}
    style={{ paddingVertical: 4 }}
  >
    <Text style={{ color: disabled ? look.muted : look.accent, fontSize: look.fontSize - 1, fontWeight: '500' }}>{title}</Text>
  </TouchableOpacity>
);

/** A labelled field. */
export const StepField: React.FC<TextInputProps & { look: StepLook; label?: string }> = ({ look, label, style, ...rest }) => (
  <View style={{ gap: 4 }}>
    {label ? <Text style={{ color: look.muted, fontSize: look.fontSize - 2, fontWeight: '500' }}>{label}</Text> : null}
    <TextInput
      placeholderTextColor={look.muted}
      accessibilityLabel={label || rest.placeholder}
      {...rest}
      style={[
        {
          borderColor: look.line,
          borderWidth: 1,
          borderRadius: Math.min(look.radius, 10),
          paddingHorizontal: 10,
          paddingVertical: 9,
          color: look.text,
          fontSize: look.fontSize,
        },
        style,
      ]}
    />
  </View>
);

/** The line under a field: the step's own words for a refused answer, else a hint. */
export const StepStatus: React.FC<{ look: StepLook; error?: string; hint?: string; testID?: string }> = ({ look, error, hint, testID }) => {
  if (!error && !hint) return null;
  return (
    <Text
      style={{ color: error ? look.error : look.muted, fontSize: look.fontSize - 2 }}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {error || hint}
    </Text>
  );
};

/** Buttons in a row, wrapping. */
export const StepRow: React.FC<{ children: React.ReactNode; end?: boolean }> = ({ children, end }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: end ? 'flex-end' : 'flex-start' }}>{children}</View>
);
