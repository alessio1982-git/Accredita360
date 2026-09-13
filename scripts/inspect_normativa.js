const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const lines = appJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('renderStoricoNormativa') || l.includes('renderProcedureManuali') || l.includes('switchProcTab') || l.includes('switchNormTab') || l.includes('normativa') || l.includes('procedure-ota')) {
    if (l.trim().startsWith('async ') || l.trim().startsWith('function ') || l.trim().includes('(') && l.includes(':')) {
      console.log(`${i+1}: ${l.trim()}`);
    }
  }
});
