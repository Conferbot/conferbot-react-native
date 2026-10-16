/**
 * ImageChoiceStep.tsx
 *
 * image-choice-node (web displayStep image choices): the pictures with
 * their labels, two to a row; a tap answers {choiceId} and the step leaves
 * by that picture's handle. The label sits in the option colours under
 * the picture.
 */

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StepViewProps, useStepLook } from './stepKit';

export const ImageChoiceStep: React.FC<StepViewProps> = ({ ui, onSubmit, busy, testID = 'step-images' }) => {
  const look = useStepLook();
  const [picked, setPicked] = useState<string | null>(null);
  const choices: any[] = ui.choices || [];

  return (
    <View
      style={{ paddingLeft: look.indent, paddingRight: look.gutter, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      accessibilityRole="radiogroup"
      testID={testID}
    >
      {choices.map((c) => {
        const on = picked === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => {
              if (picked || busy) return;
              setPicked(c.id);
              onSubmit({ choiceId: c.id, label: c.label, value: c.value ?? c.label });
            }}
            disabled={!!picked || busy}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.label}
            testID={`${testID}-choice-${c.id}`}
            style={{
              width: '47%',
              borderRadius: Math.max(look.radius, 10),
              overflow: 'hidden',
              backgroundColor: look.option,
              borderWidth: 2,
              borderColor: on ? look.accent : 'transparent',
              opacity: picked && !on ? 0.55 : 1,
            }}
          >
            <Image source={{ uri: c.imageUrl }} style={{ width: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" accessibilityIgnoresInvertColors />
            {c.label ? (
              <Text style={{ color: look.optionInk, fontSize: look.fontSize - 1, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 7, textAlign: 'center' }} numberOfLines={2}>
                {c.label}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default ImageChoiceStep;
