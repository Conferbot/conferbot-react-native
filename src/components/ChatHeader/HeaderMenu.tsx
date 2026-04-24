import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface HeaderMenuItem {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface HeaderMenuProps {
  items: HeaderMenuItem[];
  testID?: string;
}

/**
 * Three-dot overflow menu for the chat header.
 * Matches the web widget's dropdown menu (restart, download transcript, sound toggle).
 */
export const HeaderMenu: React.FC<HeaderMenuProps> = ({ items, testID }) => {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const styles = createStyles(theme);

  const handleItemPress = useCallback(
    (item: HeaderMenuItem) => {
      setVisible(false);
      // Small delay so the menu closes before the action runs
      setTimeout(() => item.onPress(), 150);
    },
    []
  );

  if (items.length === 0) return null;

  return (
    <View testID={testID}>
      {/* Three-dot button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="More options"
        accessibilityRole="button"
      >
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </TouchableOpacity>

      {/* Dropdown modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.menuContainer}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index < items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={() => handleItemPress(item)}
                accessibilityLabel={item.label}
                accessibilityRole="menuitem"
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.menuLabel,
                    item.destructive && styles.menuLabelDestructive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    menuButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 32,
      height: 32,
    },
    dotsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.headerText,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    },
    menuContainer: {
      marginTop: theme.layout.headerHeight + (Platform.OS === 'android' ? 24 : 50),
      marginRight: 12,
      backgroundColor: '#fff',
      borderRadius: 10,
      minWidth: 200,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 16,
      gap: 12,
    },
    menuItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#e5e7eb',
    },
    menuIcon: {
      fontSize: 18,
      width: 24,
      textAlign: 'center',
    },
    menuLabel: {
      fontSize: 15,
      color: '#1f2937',
      fontWeight: '500',
    },
    menuLabelDestructive: {
      color: '#ef4444',
    },
  });
