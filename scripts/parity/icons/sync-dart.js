// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Copy icons.json / motion.json into the Flutter data files.
const fs = require('fs');
const S = __dirname;
const D = `${DEV}/sdk/conferbot-flutter/lib/src/core/customization`;
const t = fs.readFileSync(`${S}/icons.json`, 'utf8');
const m = fs.readFileSync(`${S}/motion.json`, 'utf8');
for (const j of [t, m]) if (j.includes("'''")) throw new Error('cannot embed');
let a = fs.readFileSync(`${D}/launcher_icons_data.dart`, 'utf8');
a = a.replace(/const launcherIconsJson = r'''[\s\S]*?''';/, () => `const launcherIconsJson = r'''${t}''';`);
fs.writeFileSync(`${D}/launcher_icons_data.dart`, a);
fs.writeFileSync(`${D}/launcher_motion_data.dart`, `/// The launcher motion sheet (conferbot-widget src/svg/launcher/motion.ts) as
/// data: keyframes (transform and opacity stops), per icon family the
/// animations its parts play when idle and when a message arrives, origins
/// and per-class delays (see launcher_motion.dart). Generated; do not edit by
/// hand.
library;

const launcherMotionJson = r'''${m}''';
`);
