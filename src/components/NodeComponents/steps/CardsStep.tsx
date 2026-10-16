/**
 * CardsStep.tsx
 *
 * carousel-node and product-card-node (web carouselHtml): cards side by
 * side (image, title, price and description, up to three buttons). A path
 * button answers {buttonId, cardId}; a link button opens its page in the
 * browser (marked ↗) and the step keeps waiting; with no path button on
 * any card, Continue answers {action: "continue"}.
 */

import React from 'react';
import { View, Text, Image, ScrollView, Linking } from 'react-native';
import { StepButton, StepViewProps, useStepLook } from './stepKit';

const CARD_W = 230;

export const CardsStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-cards' }) => {
  const look = useStepLook();
  const cards: any[] = ui.cards || [];
  const showContinue = ui.showContinue === true || !cards.some((c) => (c.buttons || []).some((b: any) => !b.url));

  return (
    <View style={{ marginBottom: 8, gap: 8 }} testID={testID}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: look.indent, paddingRight: look.gutter, gap: 10 }}>
        {cards.map((card) => (
          <View
            key={card.id}
            style={{
              width: CARD_W,
              backgroundColor: look.card,
              borderColor: look.line,
              borderWidth: 1,
              borderRadius: Math.max(look.radius, 12),
              overflow: 'hidden',
            }}
            testID={`${testID}-card-${card.id}`}
          >
            {card.imageUrl ? (
              <Image source={{ uri: card.imageUrl }} style={{ width: CARD_W, height: 130 }} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : null}
            <View style={{ padding: 10, gap: 4 }}>
              {card.title ? <Text style={{ color: look.text, fontSize: look.fontSize, fontWeight: '600' }}>{card.title}</Text> : null}
              {card.description ? (
                <Text style={{ color: look.muted, fontSize: look.fontSize - 1 }} numberOfLines={4}>
                  {card.description}
                </Text>
              ) : null}
            </View>
            {(card.buttons || []).length ? (
              <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
                {(card.buttons || []).map((b: any) => (
                  <StepButton
                    key={b.id}
                    look={look}
                    title={b.label}
                    leading={b.url ? '↗' : undefined}
                    disabled={busy && !b.url}
                    accessibilityLabel={b.url ? `${b.label} (opens in the browser)` : b.label}
                    onPress={() => {
                      if (b.url) Linking.openURL(b.url).catch(() => undefined);
                      else onSubmit({ buttonId: b.id, cardId: card.id, label: b.label });
                    }}
                    testID={`${testID}-button-${b.id}`}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {showContinue ? (
        <View style={{ paddingLeft: look.indent, paddingRight: look.gutter, flexDirection: 'row' }}>
          <StepButton look={look} primary title="Continue" disabled={busy} onPress={() => onSubmit({ action: 'continue' })} testID={`${testID}-continue`} />
        </View>
      ) : null}
    </View>
  );
};

export default CardsStep;
