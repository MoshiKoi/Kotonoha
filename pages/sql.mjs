// @ts-check

import { fetchGzip } from "./utils.mjs";

// @ts-ignore
const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
const blob = await fetchGzip("./dictionary.db.gz");

const database = new SQL.Database(new Uint8Array(blob));

/**
 * 
 * @param {string} query 
 * @param {Object} binding 
 * @returns 
 */
function sqlite(query, binding) {
    const stmt = database.prepare(query);
    stmt.bind(binding);

    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }

    stmt.free();

    return results;
}

/**
 * @typedef {{content: string}} Gloss
 * @typedef {{part_of_speech: string, citation: string, glosses: Gloss[]}} Subentry
 * @typedef {{forms: string[], readings: string[], subentries: Subentry[]}} Entry
 */

export class PaginatedQuery {

    /** @type {string} */
    searchTerm;

    /** @type {boolean} */
    japanese;

    /** @type {number} */
    lastIndex;

    /**
     * @param {string} searchTerm 
     * @param {boolean} japanese 
     */
    constructor(searchTerm, japanese) {
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
                .map(row => row.Reading);

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