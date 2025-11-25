#!/usr/bin/env node

/**
 * Test Script for Conferbot React Native SDK
 * Tests connection to embed server on localhost:8001
 */

const io = require('socket.io-client');

// Configuration
const SOCKET_URL = 'http://localhost:8001';
const TEST_API_KEY = 'test_api_key';
const TEST_BOT_ID = 'test_bot_id';

console.log('🚀 Starting Conferbot SDK Connection Test\n');
console.log('Configuration:');
console.log(`  Socket URL: ${SOCKET_URL}`);
console.log(`  API Key: ${TEST_API_KEY}`);
console.log(`  Bot ID: ${TEST_BOT_ID}\n`);

// Create socket instance
console.log('📡 Connecting to embed server...');

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  extraHeaders: {
    'X-API-Key': TEST_API_KEY,
    'X-Bot-ID': TEST_BOT_ID,
  },
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Socket connected successfully!');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.io.engine.transport.name}\n`);

  // Test: Get chatbot data
  console.log('📤 Emitting: get-chatbot-data');
  socket.emit('get-chatbot-data', { botId: TEST_BOT_ID });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('   Make sure embed server is running on port 8001');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('\n🔌 Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('   Server initiated disconnect');
  } else {
    console.log('   Client initiated disconnect');
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
});

socket.on('reconnect', () => {
  console.log('✅ Reconnected successfully!');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Listen for server responses
socket.on('fetched-chatbot-data', (data) => {
  console.log('📥 Received: fetched-chatbot-data');
  console.log('   Data:', JSON.stringify(data, null, 2));
  console.log('\n✅ Test completed successfully!');
  console.log('   Socket connection is working correctly.\n');

  // Disconnect after successful test
  setTimeout(() => {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('bot-response', (data) => {
  console.log('📥 Received: bot-response');
  console.log('   Message:', data.text || data);
});

socket.on('agent-message', (data) => {
  console.log('📥 Received: agent-message');
  console.log('   Agent:', data.agent?.name);
  console.log('   Message:', data.message);
});

socket.on('agent-accepted', (data) => {
  console.log('📥 Received: agent-accepted');
  console.log('   Agent:', data.agent?.name);
});

socket.on('agent-left', () => {
  console.log('📥 Received: agent-left');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test terminated');
  socket.disconnect();
  process.exit(0);
});

// Timeout after 10 seconds if no response
setTimeout(() => {
  console.error('\n❌ Test timed out - no response from server');
  console.error('   Possible issues:');
  console.error('   - Embed server not running on port 8001');
  console.error('   - Firewall blocking connection');
  console.error('   - Invalid API key or bot ID\n');
  socket.disconnect();
  process.exit(1);
}, 10000);
