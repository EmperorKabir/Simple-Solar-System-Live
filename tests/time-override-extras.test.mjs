import { addUT } from '../app/src/main/assets/js/TimeOverride.js';

const start = new Date(Date.UTC(2026, 4, 3, 0, 0, 0));   // 2026-05-03 UT
let pass = 0, fail = 0;
function check(label, got, want) {
    const ok = got.toISOString() === want.toISOString();
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)}  got=${got.toISOString()}  want=${want.toISOString()}`);
    ok ? pass++ : fail++;
}
check('+1 week',              addUT(start, { weeks:  1 }), new Date(Date.UTC(2026, 4, 10)));
check('-1 week',              addUT(start, { weeks: -1 }), new Date(Date.UTC(2026, 3, 26)));
check('+1 year',              addUT(start, { years:  1 }), new Date(Date.UTC(2027, 4,  3)));
check('+10 years (1 decade)', addUT(start, { years: 10 }), new Date(Date.UTC(2036, 4,  3)));
check('Feb 29 + 1 year',      addUT(new Date(Date.UTC(2028, 1, 29)), { years: 1 }), new Date(Date.UTC(2029, 2, 1)));
console.log(`${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass+fail}`);
if (fail) process.exit(1);
