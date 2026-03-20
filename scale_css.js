const fs = require('fs');

const files = [
    'c:/DLP/client/src/components/student/StudentComponents.css',
    'c:/DLP/client/src/components/student/ViewMaterial.css',
    'c:/DLP/client/src/components/student/SyllabusManager.css'
];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let s = fs.readFileSync(f, 'utf8');

    // Decrease spacing dimensions systematically
    // 40px -> 24px
    // 32px -> 20px
    // 28px -> 18px
    // 24px -> 16px
    // 20px -> 14px
    // 16px -> 12px
    // 12px -> 8px
    // 8px -> 6px

    const propRegex = /(padding|margin|margin-top|margin-bottom|margin-left|margin-right|gap):\s*([0-9]+px)(.*?);/g;

    s = s.replace(propRegex, (match, prop, val, rest) => {
        let px = parseInt(val);
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

        return `${prop}: ${newPx}px${rest};`;
    });

    // Also handle padding shorthand with multiple values e.g., padding: 12px 24px;
    const shorthandRegex = /(padding|margin):\s*([0-9]+px)\s+([0-9]+px)(.*?);/g;
    s = s.replace(shorthandRegex, (match, prop, val1, val2, rest) => {
        const convert = (pxStr) => {
            let px = parseInt(pxStr);
            if (px >= 40) return Math.round(px * 0.6) + 'px';
            if (px === 32) return '20px';
            if (px === 28) return '18px';
            if (px === 24) return '16px';
            if (px === 20) return '14px';
            if (px === 16) return '12px';
            if (px === 14) return '10px';
            if (px === 12) return '8px';
            if (px === 8) return '6px';
            return pxStr;
        };
        return `${prop}: ${convert(val1)} ${convert(val2)}${rest};`;
    });

    fs.writeFileSync(f, s);
    console.log(`Updated ${f}`);
});
