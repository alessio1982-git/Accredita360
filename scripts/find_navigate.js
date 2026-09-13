const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const lines = appJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('navigate(') || l.includes('renderConsultantsView') || l.includes('renderPanIterTimeline')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
