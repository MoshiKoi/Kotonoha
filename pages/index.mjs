// @ts-check
import { createEntry, createMecabTokenElements } from "./templates.mjs";
import { PaginatedQuery } from "./sql.mjs";

function throttle(fn, timeout) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(fn, timeout, ...args);
    }
}

const mecabDiv = document.getElementById('mecab');
const searchInput = document.getElementById('search');
const loadMoreBtn = document.getElementById('load-more');

loadMoreBtn.addEventListener('click', loadMore);

const onSearch = throttle(() => {
    const search = searchInput.value;

    if (/[a-zA-Z0-9 ]+/.test(search)) {
        mecabDiv.replaceChildren();
        lookup(search, false)
    } else {
        mecabDiv.replaceChildren(...createMecabTokenElements(search, form => lookup(form)));
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
    const resultsDiv = document.getElementById('results');
    resultsDiv.replaceChildren();

    query = new PaginatedQuery(word, japanese);
    await loadMore();
}

async function loadMore() {
    const resultsDiv = document.getElementById('results');

    if (query) {
        for (const entry of query.loadNext()) {
            resultsDiv.append(await createEntry(entry));
        }
    }
}
