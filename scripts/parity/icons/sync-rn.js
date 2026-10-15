// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Copy icons.json / motion.json into the RN data files.
const fs = require('fs');
const S = __dirname;
const RN = `${DEV}/sdk/conferbot-react-native/src/core`;
const t = fs.readFileSync(`${S}/icons.json`, 'utf8');
const m = fs.readFileSync(`${S}/motion.json`, 'utf8');
let a = fs.readFileSync(`${RN}/launcherIcons.data.ts`, 'utf8');
a = a.replace(/export const LAUNCHER_ICONS: LauncherIconData\[\] = .*;\n/, () => `export const LAUNCHER_ICONS: LauncherIconData[] = ${t};\n`);
fs.writeFileSync(`${RN}/launcherIcons.data.ts`, a);
let b = fs.readFileSync(`${RN}/launcherMotion.data.ts`, 'utf8');
b = b.replace(/export const LAUNCHER_MOTION: LauncherMotionData = .*;\n/, () => `export const LAUNCHER_MOTION: LauncherMotionData = ${m};\n`);
fs.writeFileSync(`${RN}/launcherMotion.data.ts`, b);
