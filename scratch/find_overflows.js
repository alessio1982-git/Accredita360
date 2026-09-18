const fs = require('fs');
const html = fs.readFileSync('app.html', 'utf8');
const lines = html.split('\n');

lines.forEach((l, idx) => {
    if (l.includes('max-height') || l.includes('overflow-y')) {
        console.log((idx + 1) + ': ' + l.trim());
    }
});
