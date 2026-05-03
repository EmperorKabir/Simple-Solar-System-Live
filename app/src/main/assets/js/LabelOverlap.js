/**
 * LabelOverlap.js
 *
 * Pure-function helper for computing which CSS2D body labels should fade
 * out because they overlap a label belonging to a body with a STRICTLY
 * LARGER on-screen rendered radius.
 *
 * Pairwise iterative rule (per spec): only the smallest of any overlapping
 * pair is hidden. If three labels mutually overlap, the smallest is hidden,
 * and the middle one is left visible alongside the largest.
 *
 * @module LabelOverlap
 */

function rectsOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Build connected components of mutually-overlapping labels via BFS, then
 * for each component of size ≥ 2 hide ONLY the unique smallest label.
 * Ties: don't hide any.
 *
 * @param {Array<{id:string, rect:{x:number,y:number,w:number,h:number}, renderedRadius:number}>} labels
 * @returns {Set<string>} ids of labels that should be hidden by overlap rule
 */
export function computeHiddenByOverlap(labels) {
    const n = labels.length;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (rectsOverlap(labels[i].rect, labels[j].rect)) {
                adj[i].push(j); adj[j].push(i);
            }
        }
    }
    const seen = new Array(n).fill(false);
    const hidden = new Set();
    for (let i = 0; i < n; i++) {
        if (seen[i]) continue;
        // BFS the component containing i.
        const component = [];
        const stack = [i];
        seen[i] = true;
        while (stack.length) {
            const k = stack.pop();
            component.push(k);
            for (const m of adj[k]) if (!seen[m]) { seen[m] = true; stack.push(m); }
        }
        if (component.length < 2) continue;
        // Find unique smallest by renderedRadius. Ties → don't hide any.
        let minR = Infinity, minIdx = -1, tied = false;
        for (const k of component) {
            const r = labels[k].renderedRadius;
            if (r < minR)       { minR = r; minIdx = k; tied = false; }
            else if (r === minR) tied = true;
        }
        if (!tied && minIdx !== -1) hidden.add(labels[minIdx].id);
    }
    return hidden;
}
