const fs = require('fs');
const html = fs.readFileSync('app.html', 'utf8');

const regex = /id=["'](view-[^"']+)["']/g;
let match;
const views = [];
while ((match = regex.exec(html)) !== null) {
    views.push(match[1]);
}

console.log('Total views found:', views.length);
console.log('Views:', views);
