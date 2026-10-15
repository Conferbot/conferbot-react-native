#!/bin/bash
# Regenerate, sync into RN, compile the evaluator and compare against Chrome.
set -e
S="$(cd "$(dirname "$0")" && pwd)"
cd $S && node gen.js >/dev/null && node boxes.js >/dev/null && node motion.js >/dev/null && node sync-rn.js
cd "$S/../../.." && npx tsc --noEmit -p . | head -5
rm -rf $S/js && npx tsc src/core/launcherMotion.ts src/core/launcherIcons.ts --outDir $S/js --module commonjs --target es2019 --skipLibCheck | head -3
cd $S && node mcompare.js && python3 - <<'PY'
import json
from PIL import Image, ImageChops
im=Image.open('mcompare.png').convert('RGB')
d=json.load(open('mcases.json'))
bad={}
for c,(a,b) in zip(d['cases'],d['boxes']):
    A=im.crop((a[0],a[1],a[0]+96,a[1]+96)); B=im.crop((b[0],b[1],b[0]+96,b[1]+96))
    s=sum(ImageChops.difference(A,B).convert('L').getdata())/(96*96)
    if s>2.0: bad.setdefault(c['id']+' '+c['st'],[]).append((c['t'],round(s,1)))
print(len(d['cases']),'cases; over 2:')
for k,v in bad.items(): print(' ',k,v)
PY
