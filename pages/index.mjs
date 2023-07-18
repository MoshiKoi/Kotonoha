import { createEntry, createMecabTokenElements } from "./templates.mjs";
import Mecab from "https://unpkg.com/mecab-wasm@1.0.2/lib/mecab.js";

const SQL = await initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
});

const ds = new DecompressionStream("gzip");
const response = await fetch("./dictionary.db.gz");
const decompressionStream = response.body.pipeThrough(ds);
const blob = await new Response(decompressionStream).arrayBuffer();

const database = new SQL.Database(new Uint8Array(blob));
window.db = database;

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

await Mecab.waitReady();

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

function sqlite(query, binding) {
    const stmt = db.prepare(query);
    stmt.bind(binding);

    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }

    stmt.free();

    return results;
}

let query = null;

/**
 * Lookup a word and fill out the results
 * @param {string} word Search term
 * @param {boolean} japanese Search for Japanese
 */
async function lookup(word, japanese = true) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.replaceChildren();

    query = new PaginatedQuery(database, word, japanese);
    await loadMore();
}

async function loadMore() {
    const resultsDiv = document.getElementById('results');

    if (query) {
        for (const entry of query.loadNext()) {
            resultsDiv.append(await createEntry(entry.forms, entry.subentries));
        }
    }
}

class PaginatedQuery {
    constructor(db, searchTerm, japanese) {
        this.db = db;
        this.searchTerm = searchTerm;
        this.japanese = japanese;
        this.lastIndex = -1;
    }

    loadNext(limit = 10) {
        // TODO: Figure out a better order than just by EntryId
        const results = this.japanese
            ? sqlite(
                `SELECT DISTINCT EntryId FROM Forms
WHERE Form LIKE "%" || :word || "%" AND EntryId > :lastId
ORDER BY EntryId
LIMIT :limit`,
                { ':word': this.searchTerm, ':lastId': this.lastIndex, ':limit': limit })
            : sqlite(
                `SELECT DISTINCT EntryId FROM Subentries
INNER JOIN (SELECT SubentryId as Id FROM Glosses WHERE Content LIKE "%" || :word || "%")
WHERE Subentries.SubentryId = Id AND EntryId > :lastId
ORDER BY EntryId
LIMIT :limit`,
                { ':word': this.searchTerm, ':lastId': this.lastIndex, ':limit': limit })

        this.lastIndex = results[results.length - 1].EntryId;

        const entries = [];
        for (const id of results.map(row => row.EntryId)) {
            const forms = sqlite(`SELECT Form FROM Forms WHERE EntryId = :id`, { ':id': id })
                .map(row => row.Form);

            const readings = sqlite(`SELECT Reading FROM Readings WHERE EntryId = :id`, { ':id': id })
                .map(row => row.Form);

            const subentries = sqlite(`SELECT SubentryId, PartOfSpeech, SourceCitationId FROM Subentries WHERE EntryId = :id`, { ':id': id })
                .map(row => {
                    const citation = sqlite(`SELECT Name, Description FROM Citations WHERE CitationId = :id`, { ':id': row.SourceCitationId })[0];
                    const glosses = sqlite(`SELECT Content FROM Glosses WHERE SubentryId = :id`, { ':id': row.SubentryId })
                        .map(row => ({ content: row.Content }));

                    return {
                        part_of_speech: row.PartOfSpeech,
                        citation: citation.Name,
                        glosses: glosses,
                    };
                });

            entries.push({
                forms,
                readings,
                subentries,
            })
        }
        return entries;
    }
}