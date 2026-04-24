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
import { ConferBotProvider, ConferBotWidget, ConferBotEndpoints } from '@conferbot/react-native';
import { HeadlessExample } from './src/HeadlessExample';
import { CustomExample } from './src/CustomExample';

// Configure to local embed-server (10.0.2.2 = host localhost from Android emulator)
ConferBotEndpoints.configure({
  socketUrl: 'http://10.0.2.2:8001',
  apiBaseUrl: 'http://10.0.2.2:8001/api/v1/mobile',
});

type Tab = 'widget' | 'headless' | 'custom';

const TABS: { key: Tab; label: string }[] = [
  { key: 'widget', label: 'Widget' },
  { key: 'headless', label: 'Headless' },
  { key: 'custom', label: 'Custom' },
];

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('widget');

  // Replace with your actual API key and bot ID
  const API_KEY = 'test_key';
  const BOT_ID = '69e8503cf33718a92ea792fe';

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

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'widget' && <WidgetExample />}
        {activeTab === 'headless' && <HeadlessExample />}
        {activeTab === 'custom' && <CustomExample />}

        {/* Floating chat widget — FAB in bottom-right, opens chat modal on tap */}
        <ConferBotWidget
          title="Support Chat"
          placeholder="Type your message..."
          showTimestamps={true}
        />
      </SafeAreaView>
    </ConferBotProvider>
  );
}

/** Drop-in Widget tab content */
function WidgetExample() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Conferbot SDK Example</Text>
        <Text style={styles.subtitle}>
          Use the tabs above to switch between usage patterns
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Floating Widget</Text>
        <Text style={styles.sectionDesc}>
          Tap the chat icon in the bottom-right corner to open the chat widget.
          It reads all customizations (color, position, icon) from your bot's
          server settings automatically.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Check the docs/ folder for complete documentation
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
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
