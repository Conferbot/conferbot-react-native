// The folder holding conferbot-widget and sdk/ (override with CONFERBOT_DEV).
const DEV = process.env.CONFERBOT_DEV || require('path').resolve(__dirname, '../../../../..');
// Copy icons.json / motion.json into the iOS data files.
const fs = require('fs');
const S = __dirname;
const D = `${DEV}/sdk/conferbot-ios/Sources/Conferbot/Core/Customization`;
const t = fs.readFileSync(`${S}/icons.json`, 'utf8');
const m = fs.readFileSync(`${S}/motion.json`, 'utf8');
for (const j of [t, m]) if (j.includes('"""#')) throw new Error('cannot embed');
let a = fs.readFileSync(`${D}/LauncherIconsData.swift`, 'utf8');
a = a.replace(/static let json = #"""\n[\s\S]*?\n"""#/, () => `static let json = #"""\n${t}\n"""#`);
fs.writeFileSync(`${D}/LauncherIconsData.swift`, a);
fs.writeFileSync(`${D}/LauncherMotionData.swift`, `//
//  LauncherMotionData.swift
//  Conferbot
//
//  The launcher motion sheet (conferbot-widget src/svg/launcher/motion.ts) as
//  data: keyframes (transform and opacity stops), per icon family the
//  animations its parts play when idle and when a message arrives, origins
//  and per-class delays (see LauncherMotion.swift). Generated; do not edit by
//  hand.
//

enum LauncherMotionData {
    static let json = #"""
${m}
"""#
}
`);
