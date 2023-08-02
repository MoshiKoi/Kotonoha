// @ts-check

/**
 * Various HTML templates
 */

import { massifLookup } from "./massif.mjs";
import { User } from "./user.mjs";

/**
 * 
 * @param {(import("./mecab.mjs").MecabToken & {isUnknown?: boolean})[]} tokenization
 * @param {function(string): any} onclick
 * @returns {HTMLSpanElement[]}
*/
export function createMecabTokenElements(tokenization, onclick) {
    const tokenEls = [];

    for (const token of tokenization) {
        const tokenElement = document.createElement('button');
        tokenElement.classList.add('mecab-token');
        if (token.isUnknown) {
            tokenElement.classList.add('unknown')
        }

        let attach = false;

        switch (token.pos) {
            case '名詞': tokenElement.classList.add('mecab-noun'); break;
            case '助詞': tokenElement.classList.add('mecab-particle'); break;
            case '助動詞': tokenElement.classList.add('mecab-verb', 'mecab-aux'); attach = true; break;
            case '動詞': tokenElement.classList.add('mecab-verb'); break;
            case '副詞': tokenElement.classList.add('mecab-adverb'); break;
            case '連体詞': tokenElement.classList.add('mecab-prenominal'); break;
        }

        switch (token.pos_detail1) {
            case '接続助詞': tokenElement.classList.add('mecab-conj'); attach = true; break;
            case '非自立可能': tokenElement.classList.add('mecab-subs'); attach = true; break;
            case '接尾': tokenElement.classList.add('mecab-suffix'); attach = true; break;
        }

        tokenElement.innerText = token.str;
        tokenElement.addEventListener('click', () => onclick(token.dictionary));

        let wrapper;
        if (attach && tokenEls.length > 0) {
            wrapper = tokenEls[tokenEls.length - 1];
        } else {
            wrapper = document.createElement('span');
            wrapper.classList.add('mecab-wrapper');
            tokenEls.push(wrapper);
        }
        wrapper.appendChild(tokenElement);
    }

    return tokenEls;
}

async function createMassif(search) {
    const details = document.createElement('details');

    const summary = document.createElement('summary');
    summary.innerText = 'Sentences from massif.la';

    const loadingMessage = document.createElement('p');
    loadingMessage.classList.add('loading-message');
    loadingMessage.innerText = 'Loading...';

    details.append(summary, loadingMessage);
    details.addEventListener('toggle', async () => {
        const loadingMessage = details.querySelector('.loading-message');
        if (details.open && loadingMessage != null) {
            loadingMessage.classList.remove('loading-message');
            const sentences = [];
            for (const { sample_source: { title, url, publish_date }, tokenization, unknown } of await massifLookup(search)) {
                const sentenceWrapper = document.createElement('figure');
                const quoteEl = document.createElement('blockquote');
                quoteEl.cite = url;
                quoteEl.replaceChildren(...createMecabTokenElements(tokenization, () => console.log("Not implemented")));
                const citeWrapper = document.createElement('figcaption');
                const citeNote = document.createElement('cite');
                const citeLink = document.createElement('a');
                citeLink.href = url;
                citeLink.innerText = title;
                citeNote.append('from ', citeLink);
                citeWrapper.append(citeNote);
                sentenceWrapper.append(quoteEl, citeWrapper);
                sentences.push(sentenceWrapper);
            }
            details.append(...sentences);
            if (sentences.length == 0) {
                const notFoundMessage = document.createElement('p');
                notFoundMessage.innerText = 'No examples found';
                details.append(notFoundMessage);
            }
            loadingMessage.remove();
        }
    });

    return details;
}

/**
 * @param {import("./sql.mjs").Entry} entry 
 * @returns 
 */
export async function createEntry(entry) {
    const entryEl = document.createElement('div');
    entryEl.classList.add('entry')

    const headingEl = document.createElement('hgroup');
    const formsEl = document.createElement('h3');
    formsEl.innerText = entry.forms.join('・');
    const readingEl = document.createElement('p');
    readingEl.innerText = entry.readings.join('・');
    
    const isKnownLabel = document.createElement('label');
    isKnownLabel.innerText = 'Known?';
    isKnownLabel.classList.add('is-known-toggle')
    const isKnownToggle = document.createElement('input');
    isKnownToggle.type = 'checkbox';
    isKnownLabel.append(isKnownToggle);

    isKnownToggle.checked = entry.forms.every(form => User.getKnownWords().includes(form));
    isKnownToggle.addEventListener('change', _ => {
        if (isKnownToggle.checked) {
            User.addKnownWords(...entry.forms);
        } else {
            User.removeKnownWords(...entry.forms);
        }
    })

    headingEl.append(isKnownLabel, formsEl, readingEl);
    const massifEl = await createMassif(entry.forms[0]);

    let part_of_speech = null;
    const subentryEls = []

    for (const subentry of entry.subentries) {
        if (subentry.part_of_speech !== part_of_speech) {
            part_of_speech = subentry.part_of_speech;
            const headEl = document.createElement('h4');
            headEl.classList.add('part-of-speech')
            headEl.innerText = part_of_speech;
            subentryEls.push(headEl);
        }

        const subentryEl = document.createElement('ul');
        subentryEl.classList.add('gloss-list');
        // The database format is planned to be changed anyway before adding new sources,
        // so this entire section will most likely be entirely rewritten anyway
        const citeNote = document.createElement('cite');
        citeNote.innerText = subentry.citation;
        subentryEl.append(citeNote);
        for (const gloss of subentry.glosses) {
            const glossEl = document.createElement('li');
            glossEl.innerText = gloss.content;
            subentryEl.appendChild(glossEl);
        }
        subentryEls.push(subentryEl);
    };

    entryEl.append(headingEl, massifEl, ...subentryEls)
    return entryEl;
}