#!/bin/bash
# Compile the RN core, sample Chrome's own animations into golden.json and
# compare the evaluator against it (the jest test does the same check).
set -e
S="$(cd "$(dirname "$0")" && pwd)"
cd "$S/../../.."
rm -rf "$S/js" && npx tsc src/core/keyframes.ts src/core/launcherAttention.ts src/core/launcherIdleCall.ts src/core/launcherEntrance.ts src/core/fxPaint.ts src/core/launcherMotion.ts src/core/mascotArt.ts --outDir "$S/js" --module commonjs --target es2019 --skipLibCheck | head -3
cd "$S" && node golden.js && node compare.js
rm -rf "$S/js"
