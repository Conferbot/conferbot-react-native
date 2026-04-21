#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Conferbot React Native Example - Setup ==="
echo ""

# Step 1: Install node_modules if missing
if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing npm dependencies..."
  npm install
else
  echo "[1/3] node_modules already exists, skipping npm install."
fi

# Step 2: Generate android/ and ios/ directories if missing
if [ ! -d "android" ] || [ ! -d "ios" ]; then
  echo "[2/3] Generating native platform directories (android/ and ios/)..."

  # Clean up any leftover temp directory
  rm -rf temp_rn

  # Initialize a fresh React Native project to get native dirs
  npx react-native init ConferbotExample --version 0.73.0 --directory temp_rn --skip-install

  # Copy native directories
  if [ ! -d "android" ]; then
    cp -r temp_rn/android ./android
    echo "       - Created android/"
  fi

  if [ ! -d "ios" ]; then
    cp -r temp_rn/ios ./ios
    echo "       - Created ios/"
  fi

  # Clean up
  rm -rf temp_rn

  # Install iOS pods
  if command -v pod &> /dev/null; then
    echo "       - Running pod install for iOS..."
    cd ios && pod install && cd ..
  else
    echo "       - CocoaPods not found. Run 'cd ios && pod install' manually for iOS."
  fi
else
  echo "[2/3] android/ and ios/ directories already exist, skipping."
fi

# Step 3: Done
echo "[3/3] Setup complete!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Open App.tsx and replace the placeholder values:"
echo "     const API_KEY = 'conf_sk_your_api_key_here';  -->  your actual API key"
echo "     const BOT_ID = 'your_bot_id_here';            -->  your actual bot ID"
echo ""
echo "2. Run the app:"
echo "     iOS:     npx react-native run-ios"
echo "     Android: npx react-native run-android"
echo ""
