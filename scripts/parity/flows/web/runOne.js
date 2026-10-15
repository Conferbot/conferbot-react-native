// node web/runOne.js <case.json> : runs one case through the widget's code
// in a fresh process (the widget keeps module state between steps) and
// prints { outcome, problems, missingExports } as JSON.
// The visitor's clock is UTC unless the case says otherwise (calendar, dates).
process.env.TZ = 'UTC';
const fs = require('fs');
const fx = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (fx.visitorTimeZone) process.env.TZ = fx.visitorTimeZone;

// Math.random, fixed per case (random split, ids): fixture.random is the sequence.
const seq = Array.isArray(fx.random) && fx.random.length ? fx.random : [0.42];
let ri = 0;
Math.random = () => seq[ri++ % seq.length];

require('./env');
const { run } = require('./driver');
run(fx)
  .then((r) => {
    // Exit only once the output is flushed (a pipe is written asynchronously).
    process.stdout.write(JSON.stringify(r), () => process.exit(0));
  })
  .catch((e) => {
    process.stdout.write(JSON.stringify({ fatal: String(e && e.stack) }), () => process.exit(0));
  });
