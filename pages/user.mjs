// @ts-check

export class User {
    /** @type {string[]} */
    static #words = (() => {
        const storage = localStorage.getItem('known-words');
        return storage ? JSON.parse(storage) : [];
    })();

    /**
     * @returns {string[]}
     */
    static getKnownWords() {
        return this.#words;
    }

    /**
     * @param {...string} words 
     */
    static addKnownWords(...words) {
        this.#words.push(...words);
        localStorage.setItem('known-words', JSON.stringify(this.#words));
    }

    /**
     * @param {...string} words
     */
    static removeKnownWords(...words) {
        this.#words = this.#words.filter(word => !words.includes(word));
        localStorage.setItem('known-words', JSON.stringify(this.#words));
    }
}