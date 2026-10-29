const fs = require('fs');
const code = fs.readFileSync('C:/Users/IT/cricket-app/simulate-5over-2innings.js', 'utf8');
let depth = 0;
let inString = false;
let stringChar = '';
let inTemplate = false;
let braces = [];
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (!inString && !inTemplate) {
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
    } else if (c === '`') {
      inTemplate = true;
    } else if (c === '{') {
      depth++;
      const line = code.substring(0, i).split('\n').length;
      braces.push({ type: 'open', depth, line, pos: i, context: code.substring(i, i+60) });
    } else if (c === '}') {
      const line = code.substring(0, i).split('\n').length;
      braces.push({ type: 'close', depth, line, pos: i, context: code.substring(Math.max(0,i-40), i+20) });
      depth--;
      if (depth < 0) {
        console.log('Negative depth at position', i, 'line', code.substring(0, i).split('\n').length);
        console.log('Context:', code.substring(Math.max(0, i-50), i+50));
        // Don't break, continue to see all
      }
    }
  } else if (inString && c === stringChar && code[i-1] !== '\\') {
    inString = false;
  } else if (inTemplate && c === '`' && code[i-1] !== '\\') {
    inTemplate = false;
  }
}
console.log('Final depth:', depth);
console.log('\nAll braces:');
braces.forEach(b => console.log(`${b.type} depth=${b.depth} line=${b.line}: ${b.context.replace(/\n/g, '\\n')}`));