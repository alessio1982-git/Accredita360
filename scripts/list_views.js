const fs = require('fs');
const lines = fs.readFileSync('app.html', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('id="view-')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
