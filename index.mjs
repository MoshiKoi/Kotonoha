import { createEntry, createMecabTokenElements } from "./templates.mjs";
import Mecab from "https://unpkg.com/mecab-wasm@1.0.2/lib/mecab.js";

const SQL = await initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
});

const ds = new DecompressionStream("gzip");
const response = await fetch("./jmdict.db.gz");
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


/**
 * Lookup a word and fill out the results
 * @param {string} word Search term
 * @param {boolean} japanese Search for Japanese
 */
async function lookup(word, japanese = true) {
    const resultsDiv = document.getElementById('results');

    const results = japanese
        ? sqlite(
            `SELECT DISTINCT EntryId FROM WordForms WHERE Form LIKE "%" || :word || "%"`,
            { ':word': word })
        : sqlite(`SELECT DISTINCT EntryId FROM Subentries INNER JOIN (SELECT SubentryId as Id FROM Quotations WHERE Content LIKE "%" || :word || "%") WHERE Subentries.SubentryId = Id`,
            { ':word': word });

    const entries = [];
    for (const id of results.map(row => row.EntryId)) {
        const forms = sqlite(`SELECT Form FROM WordForms WHERE EntryId = :id`, { ':id': id })
            .map(row => row.Form);

        const subentries = sqlite(`SELECT SubentryId, PartOfSpeech FROM Subentries WHERE EntryId = :id`, { ':id': id })
            .map(row => {
                const glosses = sqlite(`SELECT Content FROM Quotations WHERE SubentryId = :id`, { ':id': row.SubentryId })
                    .map(row => ({ content: row.Content }));

                return { 
                    part_of_speech: row.PartOfSpeech,
                    glosses: glosses,
                };
            });
        
        entries.push(await createEntry(forms, subentries));
    }

    resultsDiv.replaceChildren(...entries);
}