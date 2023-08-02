export class User {
    /** @type {string[]?} */
    static #words = null;

    /**
     * @returns {string[]}
     */
    static getKnownWords() {
        if (this.#words === null) {
            this.#words = JSON.parse(localStorage.getItem('known-words')) || [];
        }

        return this.#words;
    }

    static addKnownWords(...words) {
        this.#words.push(...words);
        localStorage.setItem('known-words', JSON.stringify(this.#words));
    }

    static removeKnownWords(...words) {
        this.#words = this.#words.filter(word => !words.includes(word));
        localStorage.setItem('known-words', JSON.stringify(this.#words));
    }
}

User.getKnownWords();