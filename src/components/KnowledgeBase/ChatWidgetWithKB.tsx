/**
 * ChatWidgetWithKB Component
 *
 * Chat widget with integrated Knowledge Base access via tabs or modal
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBCategoryWithArticles, KBArticle } from './types';
import { KnowledgeBaseScreen } from './KnowledgeBaseScreen';
import { KBButton } from './KBButton';
import { ChatWidget } from '../ChatWidget';

export interface ChatWidgetWithKBProps {
  // Chat widget props
  visible?: boolean;
  onClose?: () => void;
  chatTitle?: string;
  placeholder?: string;
  enableAttachments?: boolean;
  showTimestamps?: boolean;

  // Knowledge Base props
  enableKnowledgeBase?: boolean;
  kbCategories?: KBCategoryWithArticles[];
  kbTitle?: string;
  kbIntegration?: 'tab' | 'modal' | 'header-button';

  // Callbacks
  onArticleView?: (article: KBArticle) => void;

  // Debug
  debug?: boolean;
  testID?: string;
}

/**
 * Chat widget with integrated Knowledge Base
 *
 * Features:
 * - Toggle between Chat and Help Center tabs
 * - Access KB via header button
 * - Full KB browsing with search
 * - Article viewing with ratings
 * - Seamless navigation between chat and KB
 */
export const ChatWidgetWithKB: React.FC<ChatWidgetWithKBProps> = ({
  visible: controlledVisible,
  onClose,
  chatTitle = 'Chat',
  placeholder,
  enableAttachments = false,
  showTimestamps = false,
  enableKnowledgeBase = true,
  kbCategories = [],
  kbTitle = 'Help Center',
  kbIntegration = 'tab',
  onArticleView,
  debug = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Active tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'kb'>('chat');

  // KB modal state (for header-button integration)
  const [isKBModalOpen, setIsKBModalOpen] = useState(false);

  // Tab indicator animation
  const tabIndicator = React.useRef(new Animated.Value(0)).current;

  // Animate tab indicator
  useEffect(() => {
    Animated.spring(tabIndicator, {
      toValue: activeTab === 'chat' ? 0 : 1,
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicator]);

  // Handle tab change
  const handleTabChange = useCallback((tab: 'chat' | 'kb') => {
    setActiveTab(tab);
  }, []);

  // Open KB modal (for header-button integration)
  const openKBModal = useCallback(() => {
    setIsKBModalOpen(true);
  }, []);

  // Close KB modal
  const closeKBModal = useCallback(() => {
    setIsKBModalOpen(false);
  }, []);

  // KB header action for header-button integration
  const renderKBHeaderAction = useCallback(() => {
    if (!enableKnowledgeBase || kbIntegration !== 'header-button') {
      return undefined;
    }

    return (
      <KBButton
        onPress={openKBModal}
        variant="icon"
        testID={`${testID}-kb-header-button`}
      />
    );
  }, [enableKnowledgeBase, kbIntegration, openKBModal, testID]);

  // Render tab bar
  const renderTabBar = () => {
    if (!enableKnowledgeBase || kbIntegration !== 'tab') {
      return null;
    }

    const indicatorTranslateX = tabIndicator.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 100], // Assuming tab width of 100
    });

    return (
      <View style={styles.tabBar}>
        {/* Tab Indicator */}
        <Animated.View
          style={[
            styles.tabIndicator,
            { transform: [{ translateX: indicatorTranslateX }] },
          ]}
        />

        {/* Chat Tab */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => handleTabChange('chat')}
          accessible={true}
          accessibilityLabel="Chat tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
          testID={`${testID}-tab-chat`}
        >
          <ChatIcon
            color={
              activeTab === 'chat'
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'chat' && styles.tabLabelActive,
            ]}
          >
            {chatTitle}
          </Text>
        </TouchableOpacity>

        {/* KB Tab */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => handleTabChange('kb')}
          accessible={true}
          accessibilityLabel="Help center tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'kb' }}
          testID={`${testID}-tab-kb`}
        >
          <HelpIcon
            color={
              activeTab === 'kb'
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'kb' && styles.tabLabelActive,
            ]}
          >
            {kbTitle}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render content based on active tab
  const renderContent = () => {
    if (kbIntegration === 'tab' && activeTab === 'kb') {
      return (
        <KnowledgeBaseScreen
          categories={kbCategories}
          onClose={() => handleTabChange('chat')}
          onArticleView={onArticleView}
          showHeader={false}
          headerTitle={kbTitle}
          testID={`${testID}-kb`}
        />
      );
    }

    return (
      <ChatWidget
        visible={true}
        title={chatTitle}
        placeholder={placeholder}
        enableAttachments={enableAttachments}
        showTimestamps={showTimestamps}
        debug={debug}
        testID={`${testID}-chat`}
      />
    );
  };

  // Main render for tab integration
  if (kbIntegration === 'tab') {
    return (
      <Modal
        visible={controlledVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
        statusBarTranslucent={false}
        testID={testID}
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessible={true}
                accessibilityLabel="Close"
                accessibilityRole="button"
                testID={`${testID}-close`}
              >
                <CloseIcon color={theme.colors.text} />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>
                {activeTab === 'chat' ? chatTitle : kbTitle}
              </Text>

              <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <View style={styles.content}>{renderContent()}</View>

            {/* Tab Bar */}
            {renderTabBar()}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Header button integration - regular ChatWidget + KB modal
  return (
    <>
      {/* Main Chat Widget */}
      <ChatWidget
        visible={controlledVisible}
        onClose={onClose}
        title={chatTitle}
        placeholder={placeholder}
        enableAttachments={enableAttachments}
        showTimestamps={showTimestamps}
        debug={debug}
        testID={testID}
      />

      {/* KB Modal */}
      {enableKnowledgeBase && (
        <Modal
          visible={isKBModalOpen}
          animationType="slide"
          transparent={false}
          onRequestClose={closeKBModal}
          statusBarTranslucent={false}
          testID={`${testID}-kb-modal`}
        >
          <SafeAreaView style={styles.container}>
            <KnowledgeBaseScreen
              categories={kbCategories}
              onClose={closeKBModal}
              onArticleView={onArticleView}
              headerTitle={kbTitle}
              testID={`${testID}-kb`}
            />
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
};

// Icons
const CloseIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 16,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
        position: 'absolute',
      }}
    />
    <View
      style={{
        width: 16,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '-45deg' }],
        position: 'absolute',
      }}
    />
  </View>
);

const ChatIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20 }}>
    <View
      style={{
        width: 18,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: color,
        marginTop: 1,
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 3,
        width: 0,
        height: 0,
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: color,
        transform: [{ rotate: '-30deg' }],
      }}
    />
  </View>
);

const HelpIcon: React.FC<{ color: string }> = ({ color }) => (
  <View
    style={{
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: 7,
        height: 7,
        borderTopWidth: 1.5,
        borderRightWidth: 1.5,
        borderTopRightRadius: 4,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginBottom: -2,
      }}
    />
    <View
      style={{
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        marginTop: 1,
      }}
    />
  </View>
);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      height: 56,
      ...theme.shadows.sm,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: -theme.spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      height: 60,
      paddingBottom: Platform.OS === 'ios' ? 0 : 0,
    },
    tabIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '50%',
      height: 2,
      backgroundColor: theme.colors.primary,
    },
    tab: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    tabLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },
    tabLabelActive: {
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.semibold,
    },
  });

export default ChatWidgetWithKB;
