const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('d:/테스트/forder/src/index.css', 'utf8');
css.split('\n').forEach((line, idx) => {
  if (line.includes('overflow-hidden') || line.includes('overflow: hidden')) {
    console.log(`index.css Line ${idx+1}: ${line.trim()}`);
  }
});
