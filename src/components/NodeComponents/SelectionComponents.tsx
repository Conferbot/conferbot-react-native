// @ts-nocheck
/**
 * SelectionComponents.tsx
 *
 * Components for selection-based inputs.
 * Includes: ButtonGroup, CardGrid, CarouselView, PictureChoiceGrid, DropdownPicker
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';



const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;
const CARD_WIDTH = SCREEN_WIDTH * 0.7;

// ========================================
// BUTTON GROUP
// ========================================

interface ButtonGroupProps extends NodeUIState.Buttons {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * ButtonGroup component
 *
 * Displays a list of selectable buttons.
 * Supports single and multi-select modes.
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  nodeId,
  question,
  buttons,
  variableName,
  multiSelect = false,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleButtonPress = useCallback(
    (button: ButtonGroupProps['buttons'][0]) => {
      if (isSubmitting) return;

      if (multiSelect) {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(button.id)) {
            newSet.delete(button.id);
          } else {
            newSet.add(button.id);
          }
          return newSet;
        });
      } else {
        // Single select - submit immediately
        setIsSubmitting(true);
        onSubmit({
          buttonId: button.id,
          value: button.value ?? button.label,
          label: button.label,
          variableName,
        });
      }
    },
    [multiSelect, isSubmitting, variableName, onSubmit]
  );

  const handleMultiSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    const selectedButtons = buttons.filter((b) => selectedIds.has(b.id));
    onSubmit({
      buttonIds: Array.from(selectedIds),
      values: selectedButtons.map((b) => b.value ?? b.label),
      labels: selectedButtons.map((b) => b.label),
      variableName,
    });
  }, [selectedIds, buttons, variableName, onSubmit]);

  return (
    <View
      style={{ marginBottom: 8 }}
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
      testID={testID}
    >
      {/* Choice pills only — question is already in the message list as a bot message */}
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingLeft: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
        paddingRight: theme.spacing.chatContentPadding,
      }}>
        {buttons.map((button) => (
          <TouchableOpacity
            key={button.id}
            style={{
              backgroundColor: selectedIds.has(button.id) ? theme.colors.primary : theme.colors.optionBubble,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: theme.borderRadius.button,
            }}
            onPress={() => handleButtonPress(button)}
            disabled={isSubmitting}
            accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: selectedIds.has(button.id), disabled: isSubmitting }}
            accessibilityLabel={button.label}
          >
            {button.icon && <Text style={{ marginRight: 4, fontSize: 14 }}>{button.icon}</Text>}
            <Text style={{
              color: selectedIds.has(button.id) ? theme.colors.textInverse : theme.colors.optionBubbleText,
              fontSize: theme.typography.fontSize.md,
              fontWeight: '500',
            }}>
              {button.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {multiSelect && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                selectedIds.size === 0
                  ? theme.colors.border
                  : theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={handleMultiSubmit}
          disabled={selectedIds.size === 0 || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`Submit ${selectedIds.size} selected items`}
        >
          <Text
            style={[
              styles.submitButtonText,
              {
                color:
                  selectedIds.size === 0
                    ? theme.colors.textDisabled
                    : theme.colors.textInverse,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            {isSubmitting ? 'Sending...' : `Submit (${selectedIds.size})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ========================================
// CARD GRID
// ========================================

interface CardGridProps extends NodeUIState.Cards {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * CardGrid component
 *
 * Displays a grid of cards with images, titles, descriptions, and buttons.
 */
export const CardGrid: React.FC<CardGridProps> = ({
  nodeId,
  question,
  cards,
  variableName,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCardButtonPress = useCallback(
    (cardId: string, button: NonNullable<CardGridProps['cards'][0]['buttons']>[0]) => {
      if (isSubmitting) return;

      if (button.url) {
        Linking.openURL(button.url).catch((err) => {
          console.error('Failed to open URL:', err);
        });
        return;
      }

      setIsSubmitting(true);
      onSubmit({
        cardId,
        buttonId: button.id,
        value: button.value ?? button.label,
        label: button.label,
        variableName,
      });
    },
    [isSubmitting, variableName, onSubmit]
  );

  const renderCard = (card: CardGridProps['cards'][0]) => (
    <View
      key={card.id}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderColor: theme.colors.border,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="none"
      accessibilityLabel={card.title}
    >
      {card.imageUrl && (
        <Image
          source={{ uri: card.imageUrl }}
          style={[
            styles.cardImage,
            {
              borderTopLeftRadius: theme.borderRadius.lg,
              borderTopRightRadius: theme.borderRadius.lg,
            },
          ]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      )}
      <View style={styles.cardContent}>
        <Text
          style={[
            styles.cardTitle,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.lg,
            },
          ]}
          numberOfLines={2}
        >
          {card.title}
        </Text>
        {card.description && (
          <Text
            style={[
              styles.cardDescription,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
              },
            ]}
            numberOfLines={3}
          >
            {card.description}
          </Text>
        )}
        {card.buttons && card.buttons.length > 0 && (
          <View style={styles.cardButtons}>
            {card.buttons.map((button) => (
              <TouchableOpacity
                key={button.id}
                style={[
                  styles.cardButton,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.borderRadius.sm,
                  },
                ]}
                onPress={() => handleCardButtonPress(card.id, button)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={button.label}
              >
                <Text
                  style={[
                    styles.cardButtonText,
                    {
                      color: theme.colors.textInverse,
                      fontSize: theme.typography.fontSize.sm,
                    },
                  ]}
                >
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.cardGridContainer} testID={testID}>
      {question && (
        <Text
          style={[
            styles.questionText,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.md,
              paddingHorizontal: 12,
            },
          ]}
        >
          {question}
        </Text>
      )}
      <View style={styles.cardGrid}>{cards.map(renderCard)}</View>
    </View>
  );
};

// ========================================
// CAROUSEL VIEW
// ========================================

interface CarouselViewProps extends NodeUIState.Carousel {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * CarouselView component
 *
 * Displays a horizontal scrolling carousel of cards.
 */
export const CarouselView: React.FC<CarouselViewProps> = ({
  nodeId,
  cards,
  variableName,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleCardButtonPress = useCallback(
    (cardId: string, button: NonNullable<CarouselViewProps['cards'][0]['buttons']>[0]) => {
      if (isSubmitting) return;

      if (button.url) {
        Linking.openURL(button.url).catch((err) => {
          console.error('Failed to open URL:', err);
        });
        return;
      }

      setIsSubmitting(true);
      onSubmit({
        cardId,
        buttonId: button.id,
        value: button.value ?? button.label,
        label: button.label,
        variableName,
      });
    },
    [isSubmitting, variableName, onSubmit]
  );

  const renderCarouselItem = ({
    item: card,
  }: {
    item: CarouselViewProps['cards'][0];
  }) => (
    <View
      style={[
        styles.carouselCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          width: CARD_WIDTH,
        },
        theme.shadows.md,
      ]}
      accessibilityRole="none"
      accessibilityLabel={card.title}
    >
      {card.imageUrl && (
        <Image
          source={{ uri: card.imageUrl }}
          style={[
            styles.carouselCardImage,
            {
              borderTopLeftRadius: theme.borderRadius.lg,
              borderTopRightRadius: theme.borderRadius.lg,
            },
          ]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      )}
      <View style={styles.carouselCardContent}>
        <Text
          style={[
            styles.cardTitle,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.lg,
            },
          ]}
          numberOfLines={2}
        >
          {card.title}
        </Text>
        {card.description && (
          <Text
            style={[
              styles.cardDescription,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
              },
            ]}
            numberOfLines={3}
          >
            {card.description}
          </Text>
        )}
        {card.buttons && card.buttons.length > 0 && (
          <View style={styles.cardButtons}>
            {card.buttons.map((button) => (
              <TouchableOpacity
                key={button.id}
                style={[
                  styles.cardButton,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.borderRadius.sm,
                  },
                ]}
                onPress={() => handleCardButtonPress(card.id, button)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={button.label}
              >
                <Text
                  style={[
                    styles.cardButtonText,
                    {
                      color: theme.colors.textInverse,
                      fontSize: theme.typography.fontSize.sm,
                    },
                  ]}
                >
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.carouselContainer} testID={testID}>
      <FlatList
        ref={flatListRef}
        data={cards}
        renderItem={renderCarouselItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        accessibilityRole="list"
        accessibilityLabel="Card carousel"
      />
    </View>
  );
};

// ========================================
// PICTURE CHOICE GRID
// ========================================

interface PictureChoiceGridProps extends NodeUIState.PictureChoice {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * PictureChoiceGrid component
 *
 * Displays a grid of selectable images.
 * Supports single and multi-select modes.
 */
export const PictureChoiceGrid: React.FC<PictureChoiceGridProps> = ({
  nodeId,
  question,
  choices,
  variableName,
  multiSelect = false,
  columns = 2,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemWidth =
    (SCREEN_WIDTH - 24 - (columns - 1) * 8) / columns - 8;

  const handleChoicePress = useCallback(
    (choice: PictureChoiceGridProps['choices'][0]) => {
      if (isSubmitting) return;

      if (multiSelect) {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(choice.id)) {
            newSet.delete(choice.id);
          } else {
            newSet.add(choice.id);
          }
          return newSet;
        });
      } else {
        setIsSubmitting(true);
        onSubmit({
          choiceId: choice.id,
          value: choice.value ?? choice.label ?? choice.id,
          label: choice.label,
          variableName,
        });
      }
    },
    [multiSelect, isSubmitting, variableName, onSubmit]
  );

  const handleMultiSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    const selectedChoices = choices.filter((c) => selectedIds.has(c.id));
    onSubmit({
      choiceIds: Array.from(selectedIds),
      values: selectedChoices.map((c) => c.value ?? c.label ?? c.id),
      labels: selectedChoices.map((c) => c.label),
      variableName,
    });
  }, [selectedIds, choices, variableName, onSubmit]);

  return (
    <View
      style={[
        styles.pictureChoiceContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="grid"
      accessibilityLabel={question}
      testID={testID}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      <View style={styles.pictureChoiceGrid}>
        {choices.map((choice) => {
          const isSelected = selectedIds.has(choice.id);
          return (
            <TouchableOpacity
              key={choice.id}
              style={[
                styles.pictureChoiceItem,
                {
                  width: itemWidth,
                  borderRadius: theme.borderRadius.md,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderWidth: isSelected ? 3 : 1,
                },
              ]}
              onPress={() => handleChoicePress(choice)}
              disabled={isSubmitting}
              accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
              accessibilityState={{
                checked: isSelected,
                disabled: isSubmitting,
              }}
              accessibilityLabel={choice.label || 'Image option'}
            >
              <Image
                source={{ uri: choice.imageUrl }}
                style={[
                  styles.pictureChoiceImage,
                  {
                    borderTopLeftRadius: theme.borderRadius.md - 2,
                    borderTopRightRadius: theme.borderRadius.md - 2,
                  },
                ]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              {choice.label && (
                <View
                  style={[
                    styles.pictureChoiceLabel,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.pictureChoiceLabelText,
                      {
                        color: theme.colors.text,
                        fontSize: theme.typography.fontSize.sm,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {choice.label}
                  </Text>
                </View>
              )}
              {isSelected && (
                <View
                  style={[
                    styles.pictureChoiceCheck,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text style={styles.pictureChoiceCheckText}>
                    {'\u2713'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {multiSelect && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                selectedIds.size === 0
                  ? theme.colors.border
                  : theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={handleMultiSubmit}
          disabled={selectedIds.size === 0 || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`Submit ${selectedIds.size} selected items`}
        >
          <Text
            style={[
              styles.submitButtonText,
              {
                color:
                  selectedIds.size === 0
                    ? theme.colors.textDisabled
                    : theme.colors.textInverse,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            {isSubmitting ? 'Sending...' : `Submit (${selectedIds.size})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ========================================
// DROPDOWN PICKER
// ========================================

interface DropdownPickerProps extends NodeUIState.Dropdown {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * DropdownPicker component
 *
 * Displays a dropdown/picker for selecting options.
 * Supports search and multi-select modes.
 */
export const DropdownPicker: React.FC<DropdownPickerProps> = ({
  nodeId,
  question,
  options,
  variableName,
  placeholder = 'Select an option...',
  searchable = false,
  multiSelect = false,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchText.toLowerCase())
      )
    : options;

  const selectedLabels = options
    .filter((opt) => selectedIds.has(opt.id))
    .map((opt) => opt.label);

  const handleOptionPress = useCallback(
    (option: DropdownPickerProps['options'][0]) => {
      if (isSubmitting) return;

      if (multiSelect) {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(option.id)) {
            newSet.delete(option.id);
          } else {
            newSet.add(option.id);
          }
          return newSet;
        });
      } else {
        setIsSubmitting(true);
        setIsOpen(false);
        onSubmit({
          optionId: option.id,
          value: option.value ?? option.label,
          label: option.label,
          variableName,
        });
      }
    },
    [multiSelect, isSubmitting, variableName, onSubmit]
  );

  const handleMultiSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    setIsOpen(false);
    const selectedOptions = options.filter((o) => selectedIds.has(o.id));
    onSubmit({
      optionIds: Array.from(selectedIds),
      values: selectedOptions.map((o) => o.value ?? o.label),
      labels: selectedOptions.map((o) => o.label),
      variableName,
    });
  }, [selectedIds, options, variableName, onSubmit]);

  return (
    <View
      style={[
        styles.dropdownContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="combobox"
      accessibilityLabel={question}
      testID={testID}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            borderColor: isOpen ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={() => setIsOpen(true)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={
          selectedLabels.length > 0
            ? `Selected: ${selectedLabels.join(', ')}`
            : placeholder
        }
      >
        <Text
          style={[
            styles.dropdownTriggerText,
            {
              color:
                selectedLabels.length > 0
                  ? theme.colors.text
                  : theme.colors.textDisabled,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
          numberOfLines={1}
        >
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </Text>
        <Text
          style={[
            styles.dropdownArrow,
            { color: theme.colors.textSecondary },
          ]}
        >
          {isOpen ? '\u25B2' : '\u25BC'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={[
              styles.dropdownModal,
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.borderRadius.xl,
                borderTopRightRadius: theme.borderRadius.xl,
              },
            ]}
          >
            <View style={styles.dropdownModalHeader}>
              <View
                style={[
                  styles.dropdownHandle,
                  { backgroundColor: theme.colors.border },
                ]}
              />
              <Text
                style={[
                  styles.dropdownModalTitle,
                  {
                    color: theme.colors.text,
                    fontSize: theme.typography.fontSize.lg,
                  },
                ]}
              >
                {question}
              </Text>
            </View>

            {searchable && (
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: theme.colors.background,
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      color: theme.colors.text,
                      fontSize: theme.typography.fontSize.md,
                    },
                  ]}
                  placeholder="Search..."
                  placeholderTextColor={theme.colors.textDisabled}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoFocus
                />
              </View>
            )}

            <ScrollView style={styles.optionsList}>
              {filteredOptions.map((option) => {
                const isSelected = selectedIds.has(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primaryLight
                          : theme.colors.surface,
                        borderBottomColor: theme.colors.divider,
                      },
                    ]}
                    onPress={() => handleOptionPress(option)}
                    accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={option.label}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: theme.colors.text,
                          fontSize: theme.typography.fontSize.md,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Text
                        style={[
                          styles.optionCheck,
                          { color: theme.colors.primary },
                        ]}
                      >
                        {'\u2713'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {multiSelect && (
              <View style={styles.dropdownModalFooter}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor:
                        selectedIds.size === 0
                          ? theme.colors.border
                          : theme.colors.primary,
                      borderRadius: theme.borderRadius.md,
                    },
                  ]}
                  onPress={handleMultiSubmit}
                  disabled={selectedIds.size === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Submit ${selectedIds.size} selected items`}
                >
                  <Text
                    style={[
                      styles.submitButtonText,
                      {
                        color:
                          selectedIds.size === 0
                            ? theme.colors.textDisabled
                            : theme.colors.textInverse,
                        fontSize: theme.typography.fontSize.md,
                      },
                    ]}
                  >
                    Done ({selectedIds.size})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  // Common styles
  questionText: {
    marginBottom: 16,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  submitButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Button Group styles
  buttonGroupContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  buttonsContainer: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  buttonIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  buttonText: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Card styles
  cardGridContainer: {
    marginVertical: 8,
  },
  cardGrid: {
    paddingHorizontal: 12,
  },
  card: {
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: MAX_WIDTH,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cardDescription: {
    marginBottom: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cardButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  cardButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  cardButtonText: {
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Carousel styles
  carouselContainer: {
    marginVertical: 8,
  },
  carouselContent: {
    paddingHorizontal: 12,
  },
  carouselCard: {
    marginRight: 12,
    overflow: 'hidden',
  },
  carouselCardImage: {
    width: '100%',
    height: 140,
  },
  carouselCardContent: {
    padding: 12,
  },

  // Picture Choice styles
  pictureChoiceContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  pictureChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  pictureChoiceItem: {
    margin: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  pictureChoiceImage: {
    width: '100%',
    aspectRatio: 1,
  },
  pictureChoiceLabel: {
    padding: 8,
  },
  pictureChoiceLabelText: {
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  pictureChoiceCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pictureChoiceCheckText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Dropdown styles
  dropdownContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  dropdownTriggerText: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  dropdownArrow: {
    fontSize: 12,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownModal: {
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  dropdownModalHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dropdownHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  dropdownModalTitle: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  searchContainer: {
    margin: 16,
    paddingHorizontal: 16,
  },
  searchInput: {
    height: 44,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  optionsList: {
    flex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  optionText: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  optionCheck: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  dropdownModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

export default {
  ButtonGroup,
  CardGrid,
  CarouselView,
  PictureChoiceGrid,
  DropdownPicker,
};
