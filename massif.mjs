/**
 * 
 * @param {string} str 
 * @returns {Promise<string[]>}
 */
export async function massifLookup(str) {
    const response = await fetch(`https://massif.la/ja/search?q=${encodeURIComponent(str)}&fmt=json`);
    const data = await response.json();

    return data.results;
}