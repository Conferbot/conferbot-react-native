// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Copy icons.json / motion.json into the Android data files.
const fs = require('fs');
const S = __dirname;
const D = `${DEV}/sdk/conferbot-android/conferbot/src/main/java/com/conferbot/sdk/core/customization`;
const t = fs.readFileSync(`${S}/icons.json`, 'utf8');
const m = fs.readFileSync(`${S}/motion.json`, 'utf8');
for (const j of [t, m]) if (j.includes('"""') || j.includes('$')) throw new Error('cannot embed');
let a = fs.readFileSync(`${D}/LauncherIconsData.kt`, 'utf8');
a = a.replace(/const val JSON = """[\s\S]*?"""/, () => `const val JSON = """${t}"""`);
fs.writeFileSync(`${D}/LauncherIconsData.kt`, a);
fs.writeFileSync(`${D}/LauncherMotionData.kt`, `package com.conferbot.sdk.core.customization

/**
 * The launcher motion sheet (conferbot-widget src/svg/launcher/motion.ts) as
 * data: keyframes (transform and opacity stops), per icon family the
 * animations its parts play when idle and when a message arrives, origins
 * and per-class delays (see LauncherMotion). Generated; do not edit by hand.
 */
internal object LauncherMotionData {
    const val JSON = """${m}"""
}
`);
