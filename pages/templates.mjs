/**
 * Various HTML templates
 */

import Mecab from "https://unpkg.com/mecab-wasm@1.0.2/lib/mecab.js";
import { massifLookup } from "./massif.mjs";

await Mecab.waitReady();

/**
 * 
 * @param {string} search 
 * @returns {HTMLButtonElement[]}
*/
export function createMecabTokenElements(search, onclick) {
    const tokenEls = [];

    for (const token of Mecab.query(search)) {
        const tokenElement = document.createElement('button');
        tokenElement.classList.add('mecab-token');

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
            case '接尾': tokenElement.classList.add('mecab-suffix'); attach = true; break;
        }

        tokenElement.innerText = token.word;
        tokenElement.addEventListener('click', () => onclick(token.dictionary_form));

        let wrapper;
        if (attach) {
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
    details.append(summary);
    details.addEventListener('toggle', async () => {
        if (details.open && details.children.length == 1) {
            const sentences = [];
            for (const { sample_source: { title, url, publish_date }, text } of await massifLookup(search)) {
                const sentenceWrapper = document.createElement('figure');
                const quoteEl = document.createElement('blockquote');
                quoteEl.cite = url;
                quoteEl.replaceChildren(...createMecabTokenElements(text));
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
        }
    });

    return details;
}

export async function createEntry(forms, subentries) {
    const entryEl = document.createElement('div');
    entryEl.classList.add('entry')

    const headingEl = document.createElement('h3');
    headingEl.innerText = forms.join('・');

    const massifEl = await createMassif(forms[0]);

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

    entryEl.append(headingEl, massifEl, ...subentryEls)
    return entryEl;
}