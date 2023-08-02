// @ts-check

import { User } from "./user.mjs";
import { mecabParse } from "./mecab.mjs";

/**
 * 
 * @param {string} str 
 */
export async function massifLookup(str) {
    const response = await fetch(`https://massif.la/ja/search?q=${encodeURIComponent(str)}&fmt=json`);

    /** @type {{results: { sample_source: { title: string, url: string, publish_date: string }, text: string}[]}} */
    const data = await response.json();

    const sortedData = data.results.map(entry => {
        const tokenization = mecabParse(entry.text)
            .map(token => Object.assign(token, { isUnknown: !User.getKnownWords().includes(token.dictionary) }));
        return {
            sample_source: entry.sample_source,
            tokenization,
            unknown: tokenization
                .filter(token => token.isUnknown)
                .length
        }
    }).sort((a, b) => a.unknown - b.unknown);

    return sortedData;
}