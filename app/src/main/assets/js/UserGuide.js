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
        title: 'What is this app?',
        body: '<ul>' +
            '<li>This app is a simplified representation of the solar system.</li>' +
            '<li>All 8 major planets (and Pluto if you want to see it) and a subset of their major moons are visible.</li>' +
            '</ul>'
    },
    {
        title: 'Getting Around',
        subsections: [
            { title: 'Move the camera',
              body: '<ul>' +
                  '<li>Drag with one finger to orbit the scene.</li>' +
                  '<li>Pinch with two fingers to zoom in or out.</li>' +
                  '<li>Drag with two fingers to pan sideways.</li>' +
                  '</ul>' },
            { title: 'Jump to a body',
              body: '<ul>' +
                  '<li>Tap any planet, moon, or the Sun to fly the camera over to it.</li>' +
                  '<li>The ‘Jump to Body…’ dropdown in the top-left lists all planets, moons and the Sun available to view in this app. Tap any of them to jump the camera over to whichever you select.</li>' +
                  '</ul>' },
            { title: 'Reset the view',
              body: '<ul>' +
                  '<li>Tap ‘Reset View’ at the top-left to fly back out to the whole solar system which is the default view when you open the app.</li>' +
                  '</ul>' }
        ]
    },
    {
        title: 'Time Travel',
        subsections: [
            { title: 'LIVE vs. JUMP',
              body: '<ul>' +
                  '<li>By default, the app shows where everything is right now which is LIVE mode (in green).</li>' +
                  '<li>The moment you change the time, you switch to JUMP mode (in amber) and the solar system in the app freezes at that moment.</li>' +
                  '</ul>' },
            { title: 'Quick nudges',
              body: '<ul>' +
                  '<li>The −/+ buttons jump backward or forward by hour, day, week, month, year, or decade.</li>' +
                  '<li>Tap once for a single jump.</li>' +
                  '<li><strong>Hold any button to start auto-repeat</strong> (4 jumps per second); this will create a moving picture style effect of seeing how the solar system moves in faster time. Release to stop.</li>' +
                  '</ul>' },
            { title: 'Pick a date',
              body: '<ul>' +
                  '<li>Tap the date/time field to open your phone’s native picker and jump to any moment.</li>' +
                  '</ul>' },
            { title: 'Back to live',
              body: '<ul>' +
                  '<li>Tap the green LIVE button to return to real-time.</li>' +
                  '</ul>' }
        ]
    },
    {
        title: 'Time Zones',
        subsections: [
            { title: 'Default zone',
              body: '<ul>' +
                  '<li>On first launch, the app uses your phone’s system time zone.</li>' +
                  '<li>If the system zone can’t be detected, you’ll be asked to pick one.</li>' +
                  '</ul>' },
            { title: 'Change zone',
              body: '<ul>' +
                  '<li>Tap the small zone tag (e.g. UTC+01:00) next to the LIVE/JUMP indicator to switch.</li>' +
                  '<li>Your choice is remembered.</li>' +
                  '</ul>' }
        ]
    },
    {
        title: 'What You’re Looking At',
        subsections: [
            { title: 'Planetary positions',
              body: '<ul>' +
                  '<li>Every planet sits at its real position in its orbit, scaled down so the whole system fits on screen.</li>' +
                  '<li>The faint grey rings are the orbital paths.</li>' +
                  '</ul>' },
            { title: 'Moons',
              body: '<ul>' +
                  '<li>Each major moon orbits its parent planet at the right relative direction.</li>' +
                  '<li>Moon distances within a system are roughly proportional, but very-distant moons (like Saturn’s Iapetus) are pulled in a bit so they fit into the screen.</li>' +
                  '</ul>' },
            { title: 'Labels',
              body: '<ul>' +
                  '<li>Body names appear next to the bigger objects.</li>' +
                  '<li>They quietly fade out when they’re behind another body, when you zoom too far away or when two labels would otherwise sit on top of each other.</li>' +
                  '</ul>' },
            { title: 'Sun lighting',
              body: '<ul>' +
                  '<li>The Sun lights every body realistically — you’ll see day/night sides correctly as bodies rotate.</li>' +
                  '</ul>' }
        ]
    },
    {
        title: 'Icons in the Corner',
        body: '<ul>' +
            '<li>A small ⚠ triangle and an ⓘ circle sit just above the time controls.</li>' +
            '<li>The triangle is the accuracy notice — tap it for a reminder that distances are scaled.</li>' +
            '<li>The ⓘ opens this guide.</li>' +
            '</ul>'
    },
    {
        title: 'Restrictions and Disclaimer',
        body: '<ul>' +
            '<li>No minor moons or other solar system features are visible (e.g. asteroid belt, minor moons, Kuiper belt, other dwarf planets etc).</li>' +
            '<li>Orbital distances of planets from the sun are represented as equidistant; orbital rings of planets in reality are not equally as far away from each other’s orbital rings.</li>' +
            '<li>In some scenarios, moon positions, moon distances from parent planets, tilts, and day stage may be shifted slightly from reality, though are in almost all cases largely accurate.</li>' +
            '<li>The app is designed to give the user a fairly accurate but still technically approximate idea of where planets are in their day and year cycle as well as a relatively accurate approximation to where their major moons are relative to the parent planet and its other major moons.</li>' +
            '<li>In some scenarios, when planets are close to each other, it may look as though some moons are closer to a different planet than its own parent planet. To double check which planet has a particular moon, use the ‘Jump to Body…’ function to see moons indented in the list below each planet.</li>' +
            '<li>This app should not be used as a scientific source to drive any serious contingent outcomes; it is for interest and introductory education or simplistic education only (e.g. approximate guide for telescope use, learning approximate fundamentals of orbits etc).</li>' +
            '<li>This is an indicative guide, not an astronomical instrument. Planet sizes, distances, and a few outer-moon orbits are visually compressed so everything fits on screen. Positions of all major bodies match real-world ephemerides to within about a degree.</li>' +
            '</ul>'
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
