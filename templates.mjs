/**
 * Various HTML templates
 */

export function createEntry(forms, subentries) {
    const entryEl = document.createElement('div');
    entryEl.classList.add('entry')

    const headingEl = document.createElement('h3');
    headingEl.innerText = forms.join('・');

    let part_of_speech = null;
    const subentryEls = []

    for (const subentry of subentries) {
        if (subentry.part_of_speech !== part_of_speech) {
            part_of_speech = subentry.part_of_speech;
            const headEl = document.createElement('h4');
            headEl.classList.add('part-of-speech')
            headEl.innerText = part_of_speech;
            subentryEls.push(headEl);
        }

        const subentryEl = document.createElement('ul');
        subentryEl.classList.add('gloss-list');
        for (const gloss of subentry.glosses) {
            const glossEl = document.createElement('li');
            glossEl.innerText = gloss.content;
            subentryEl.appendChild(glossEl);
        }
        subentryEls.push(subentryEl);
    };

    entryEl.append(headingEl, ...subentryEls)
    return entryEl;
}