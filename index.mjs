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

const onSearch = throttle(runMecab, 500);

searchInput.addEventListener('input', onSearch);
searchInput.addEventListener('paste', onSearch);
searchInput.addEventListener('change', onSearch);

searchInput.value = 'おはようございます！';
onSearch();

function runMecab() {
    const search = searchInput.value;
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

    console.log(stmt.getSQL());
    stmt.free();

    return results;
}

async function lookup(word) {
    const resultsDiv = document.getElementById('results');

    const results = sqlite(
        `SELECT DISTINCT EntryId FROM WordForms WHERE Form LIKE "%" || :word || "%"`,
        { ':word': word });

    const entries = [];
    for (const id of results.map(row => row.EntryId)) {
        const forms = sqlite(`SELECT Form FROM WordForms WHERE EntryId = :id`, { ':id': id })
            .map(row => row.Form)
            .join('・');

        const subentries = sqlite(`SELECT SubentryId FROM Subentries WHERE EntryId = :id`, { ':id': id })
            .map(row => {
                const el = document.createElement('ul');
                const glosses = sqlite(`SELECT * FROM Quotations WHERE SubentryId = :id`, { ':id': row.SubentryId })
                    .map(row => {
                        const el = document.createElement('li');
                        el.innerText = row.Content;
                        return el;
                    });
                el.append(...glosses);
                return el;
            });

        const heading = document.createElement('h3');
        heading.innerText = forms;

        const entryDiv = document.createElement('div');
        entryDiv.append(heading, ...subentries);
        entries.push(entryDiv);
    }

    resultsDiv.replaceChildren(...entries);
}