/**
 * UserGuide.js
 *
 * Friendly, conversational app guide content. Each section becomes a
 * collapsible <details> element so users can scan headings and tap to
 * expand. Subsections render as headings + paragraphs inside.
 *
 * @module UserGuide
 */

export const GUIDE_SECTIONS = [
    {
        title: 'Getting Around',
        subsections: [
            { title: 'Move the camera',
              body: 'Drag with one finger to orbit the scene. Pinch with two fingers to zoom in or out. Drag with two fingers to pan sideways.' },
            { title: 'Jump to a body',
              body: 'Tap any planet, moon, or the Sun to fly the camera over to it. The "Jump to Body…" dropdown in the top-left has a quick alphabetical list.' },
            { title: 'Reset the view',
              body: 'Tap "Reset View" (top-left) to fly back out to the whole solar system.' }
        ]
    },
    {
        title: 'Time Travel',
        subsections: [
            { title: 'LIVE vs. JUMP',
              body: 'By default the app shows where everything is <em>right now</em> — that\'s LIVE mode (in green). The moment you change the time, you switch to JUMP mode (in amber) and the world freezes at that moment.' },
            { title: 'Quick nudges',
              body: 'The −/+ buttons jump backward or forward by hour, day, week, month, year, or decade. Tap once for a single jump. <strong>Hold any button for about ¾ of a second to start auto-repeat</strong> (4 jumps per second). Release to stop.' },
            { title: 'Pick a date',
              body: 'Tap the date/time field to open your phone\'s native picker and jump to any moment.' },
            { title: 'Back to live',
              body: 'Tap the green LIVE button to return to real-time.' }
        ]
    },
    {
        title: 'What You\'re Looking At',
        subsections: [
            { title: 'Planet positions',
              body: 'Every planet sits at its real position in its orbit, scaled down so the whole system fits on screen. The faint grey rings are the orbital paths.' },
            { title: 'Moons',
              body: 'Each major moon orbits its parent planet at the right relative direction. Moon distances within a system are roughly proportional, but very-distant moons (like Saturn\'s Iapetus) are pulled in a bit so they fit.' },
            { title: 'Labels',
              body: 'Body names appear next to the bigger objects. They quietly fade out when they\'re behind another body, when you zoom too far away, or when two labels would otherwise sit on top of each other.' },
            { title: 'Sun lighting',
              body: 'The Sun lights every body realistically — you\'ll see day/night sides correctly as bodies rotate.' }
        ]
    },
    {
        title: 'Time Zones',
        subsections: [
            { title: 'Default zone',
              body: 'On first launch the app uses your phone\'s system time zone. If the system zone can\'t be detected you\'ll be asked to pick one.' },
            { title: 'Change zone',
              body: 'Tap the small zone tag (e.g. UTC+01:00) next to the LIVE/JUMP indicator to switch. Your choice is remembered for next time.' }
        ]
    },
    {
        title: 'Icons in the Corner',
        body: 'A small ⚠ triangle and an ⓘ circle sit just above the time controls. The triangle is the accuracy notice — tap it for a reminder that distances are scaled. The ⓘ opens this guide.'
    },
    {
        title: 'Limitations',
        body: 'This is an indicative guide, not an astronomical instrument. Planet sizes, distances, and a few outer-moon orbits are visually compressed so everything fits on screen. Positions of all major bodies match real-world ephemerides to within about a degree.'
    }
];

/** Render the guide into a container element. */
export function renderGuide(container) {
    container.innerHTML = '';
    for (const sec of GUIDE_SECTIONS) {
        const det = document.createElement('details');
        det.className = 'guide-section';
        const sum = document.createElement('summary');
        sum.textContent = sec.title;
        det.appendChild(sum);
        if (sec.body) {
            const p = document.createElement('p');
            p.innerHTML = sec.body;
            det.appendChild(p);
        }
        if (sec.subsections) {
            for (const sub of sec.subsections) {
                const h = document.createElement('h4');
                h.textContent = sub.title;
                const p = document.createElement('p');
                p.innerHTML = sub.body;
                det.appendChild(h);
                det.appendChild(p);
            }
        }
        container.appendChild(det);
    }
}
