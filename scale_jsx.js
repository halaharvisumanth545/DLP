const fs = require('fs');
const path = require('path');

const dir = 'c:/DLP/client/src/components/student';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx')).map(f => path.join(dir, f));

files.forEach(f => {
    let s = fs.readFileSync(f, 'utf8');

    // Scale pixel values in standard style objects matching pattern 'margin: "24px"' or margin: '24px'
    const propRegex = /(padding|margin|marginTop|marginBottom|marginLeft|marginRight|gap|paddingTop|paddingBottom|paddingLeft|paddingRight):\s*['"]([0-9]+)px['"]/g;

    let changed = false;
    s = s.replace(propRegex, (match, prop, valStr) => {
        let px = parseInt(valStr);
        let newPx = px;
        if (px >= 40) newPx = Math.round(px * 0.6);
        else if (px === 32) newPx = 20;
        else if (px === 28) newPx = 18;
        else if (px === 24) newPx = 16;
        else if (px === 20) newPx = 14;
        else if (px === 16) newPx = 12;
        else if (px === 14) newPx = 10;
        else if (px === 12) newPx = 8;
        else if (px === 8) newPx = 6;

        if (px !== newPx) changed = true;
        // Keep quote style
        const quote = match.includes("'") ? "'" : '"';
        return `${prop}: ${quote}${newPx}px${quote}`;
    });

    if (changed) {
        fs.writeFileSync(f, s);
        console.log(`Updated inline styles in ${f}`);
    }
});
