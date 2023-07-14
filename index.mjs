import { createEntry } from "./templates.mjs";
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
        runMecab('');
        lookup(search, false)
    } else {
        runMecab(search);
        const event = new Event('click');
        mecabDiv.firstChild?.firstChild?.dispatchEvent(event);
    }
}, 500);

searchInput.addEventListener('input', onSearch);
searchInput.addEventListener('paste', onSearch);
searchInput.addEventListener('change', onSearch);

runMecab('おはようございます！');

function runMecab(search) {
    const tokens = [];

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
        tokenElement.addEventListener('click', () => lookup(token.dictionary_form));

        let wrapper;
        if (attach) {
            wrapper = tokens[tokens.length - 1];
        } else {
            wrapper = document.createElement('span');
            wrapper.classList.add('mecab-wrapper');
            tokens.push(wrapper);
        }
        wrapper.appendChild(tokenElement);
    }

    mecabDiv.replaceChildren(...tokens);
}

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
        
        entries.push(createEntry(forms, subentries));
    }

    resultsDiv.replaceChildren(...entries);
}