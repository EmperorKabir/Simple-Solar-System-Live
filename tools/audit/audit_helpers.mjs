export const DEG2RAD = Math.PI / 180.0;
export const RAD2DEG = 180.0 / Math.PI;

export function vecLen(v)    { return Math.hypot(v.x, v.y, v.z); }
export function vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }

let pass = 0, fail = 0;
const failures = [];

export function assertNear(label, actual, expected, tol) {
    const err = Math.abs(actual - expected);
    const ok = err <= tol;
    if (ok) {
        pass++;
        console.log(`  PASS  ${label}  err=${err.toExponential(3)}  tol=${tol}`);
    } else {
        fail++;
        failures.push({ label, actual, expected, err, tol });
        console.log(`  FAIL  ${label}  actual=${actual}  expected=${expected}  err=${err}  tol=${tol}`);
    }
    return ok;
}

export function assertVecNear(label, actual, expected, tol) {
    const err = vecLen(vecSub(actual, expected));
    return assertNear(label, err, 0, tol);
}

export function summary() {
    console.log(`\n${pass} passed, ${fail} failed.`);
    if (fail > 0) process.exitCode = 1;
}
