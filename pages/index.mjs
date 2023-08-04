// @ts-check
import { createEntry, createMecabTokenElements } from "./templates.mjs";
import { PaginatedQuery } from "./sql.mjs";
import { mecabParse } from "./mecab.mjs";
import { User } from "./user.mjs";

/**
 * @param {function(...*): void} fn 
 * @param {number} timeout 
 */
function throttle(fn, timeout) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(fn, timeout, ...args);
    }
}

const settingsDialog = /** @type {HTMLDialogElement} */ (document.getElementById('settings'));
const settingsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('settingsBtn'));
const knownWordsArea = /** @type {HTMLTextAreaElement} */ (document.getElementById('known-words'));
const mecabDiv = /** @type {HTMLDivElement} */ (document.getElementById('mecab'));
const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('search'));
const loadMoreBtn = /** @type {HTMLButtonElement} */ (document.getElementById('load-more'));
const resultsDiv = /** @type {HTMLDivElement} */ (document.getElementById('results'));

for (const btn of document.getElementsByClassName('closeBtn')) {
    btn.addEventListener('click', _ => btn.closest('dialog')?.close());
}

settingsBtn.addEventListener('click', _ => {
    knownWordsArea.value = User.getKnownWords().join('\n');
    settingsDialog.showModal()
});
knownWordsArea.addEventListener('change', _ => User.setKnownWords(knownWordsArea.value.split('\n')))

loadMoreBtn.addEventListener('click', loadMore);

const onSearch = throttle(() => {
    const search = searchInput.value;

    if (/[a-zA-Z0-9 ]+/.test(search)) {
        mecabDiv.replaceChildren();
        lookup(search, false)
    } else {
        mecabDiv.replaceChildren(...createMecabTokenElements(mecabParse(search), form => lookup(form)));
        const event = new Event('click');
        mecabDiv.firstChild?.firstChild?.dispatchEvent(event);
    }
}, 500);

searchInput.addEventListener('input', onSearch);
searchInput.addEventListener('paste', onSearch);
searchInput.addEventListener('change', onSearch);

/** @type {PaginatedQuery?} */
let query = null;

/**
 * Lookup a word and fill out the results
 * @param {string} word Search term
 * @param {boolean} japanese Search for Japanese
 */
async function lookup(word, japanese = true) {
    resultsDiv.replaceChildren();

    query = new PaginatedQuery(word, japanese);
    await loadMore();
}

async function loadMore() {
    if (query) {
        for (const entry of query.loadNext()) {
            resultsDiv.append(await createEntry(entry));
        }
    }
}
