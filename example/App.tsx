import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { ConferBotProvider, ChatWidget } from '@conferbot/react-native';

/**
 * Example App demonstrating Conferbot React Native SDK
 *
 * This example shows three usage patterns:
 * 1. Drop-in Widget (easiest)
 * 2. Headless SDK (custom UI)
 * 3. Mix & Match (use some components)
 */

function App(): React.JSX.Element {
  const [widgetVisible, setWidgetVisible] = useState(false);

  // Replace with your actual API key and bot ID
  const API_KEY = 'conf_sk_your_api_key_here';
  const BOT_ID = 'your_bot_id_here';

  return (
    <ConferBotProvider
      apiKey={API_KEY}
      botId={BOT_ID}
      config={{
        enableNotifications: true,
        enableOfflineMode: true,
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Conferbot SDK Example</Text>
            <Text style={styles.subtitle}>
              Tap an option below to see different usage patterns
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Option 1: Drop-in Widget</Text>
            <Text style={styles.sectionDesc}>
              Full-featured chat in a modal. Easiest integration.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setWidgetVisible(true)}
            >
              <Text style={styles.buttonText}>Open Chat Widget</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Option 2: Headless SDK</Text>
            <Text style={styles.sectionDesc}>
              Use the SDK context to build your own UI. See HeadlessExample.tsx
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => {
                // Navigate to headless example
                console.log('See src/HeadlessExample.tsx for headless usage');
              }}
            >
              <Text style={styles.buttonTextSecondary}>View Headless Example</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Option 3: Mix & Match</Text>
            <Text style={styles.sectionDesc}>
              Use our components where you want, custom where you need.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => {
                // Navigate to custom example
                console.log('See src/CustomExample.tsx for mix & match usage');
              }}
            >
              <Text style={styles.buttonTextSecondary}>View Custom Example</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              📚 Check the docs/ folder for complete documentation
            </Text>
          </View>
        </ScrollView>

        {/* The widget */}
        <ChatWidget
          visible={widgetVisible}
          onClose={() => setWidgetVisible(false)}
          title="Support Chat"
          placeholder="Type your message..."
          showTimestamps={true}
        />
      </SafeAreaView>
    </ConferBotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#F0F0F0',
  },
  buttonTextSecondary: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default App;
