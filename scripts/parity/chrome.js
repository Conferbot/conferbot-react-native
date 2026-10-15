// Where Chrome is: CHROME_PATH when set, else /usr/bin/google-chrome (Linux,
// the default), else the macOS app.
const fs = require('fs');
const MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
module.exports = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') || !fs.existsSync(MAC) ? '/usr/bin/google-chrome' : MAC);
