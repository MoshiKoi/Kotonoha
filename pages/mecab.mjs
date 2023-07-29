// @ts-check
// Basic mecab parser

import { fetchGzip } from "./utils.mjs";

const dicBuffer = await fetchGzip('./unidic/sys.dic.gz');
const matrixBuffer = await fetchGzip('./unidic/matrix.bin.gz');

const MAGIC = 0xef718f77;
const VERSION = 102;
const INT16MAX = (2 << 15) - 1;

export class MecabDict {
    // Double array trie
    // Thankfully it only needs to be read-only because I have no clue how to implement an actual trie

    /**
     * @typedef {{value: number, length: number}} Result
     * @typedef {{leftId: number, rightId: number, posId: number, weight: number, feature: number, compound: number}} Token
     * @typedef {{previous: ParseNode?, start: number, end: number, token: Token, cost: number}} ParseNode
     */

    /** @type {{base: number, check: number}[]} */
    doubleArray;

    /** @type {string} */
    charSet;

    /** @type {Token[]} */
    tokens;

    /** @type {Int16Array} */
    matrix;

    /** @type {number} */
    leftSize;

    /** @type {number} */
    rightSize;

    /** @type {Uint8Array} */
    featuresArray;

    constructor() {
        this.doubleArray = [];
        this.charSet = '';
        this.tokens = [];
        this.matrix = new Int16Array();
        this.featuresArray = new Uint8Array();
        this.leftSize = 0;
        this.rightSize = 0;
    }

    /**
     * @param {Uint8Array} dicArray 
     */
    loadDictionary(dicArray) {
        let index = 0;

        function nextUint16() {
            const [b1, b2] = dicArray.subarray(index, index + 2);
            index += 2;
            return (b1 | (b2 << 8)) >>> 0;
        }

        function nextInt16() {
            const [b1, b2] = dicArray.subarray(index, index + 2);
            index += 2;
            let temp = (b1 | (b2 << 8)); // JS does it as 32 bit signed; we don't expect overflow
            if (temp > INT16MAX) {
                temp -= INT16MAX;
            }
            return temp;
        }

        function nextUint32() {
            const [b1, b2, b3, b4] = dicArray.subarray(index, index + 4);
            index += 4;
            return (b1
                | (b2 << 8)
                | (b3 << 16)
                | (b4 << 24)) >>> 0;
        }

        const magic = nextUint32();
        if ((magic ^ MAGIC) !== dicArray.length) {
            throw new Error(`Dictionary is invalid (${magic} ^ ${MAGIC} != ${dicArray.byteLength} )`);
        }

        const version = nextUint32();
        if (version !== VERSION) {
            throw new Error("Incompatible dictionary version");
        }

        // Metadata

        const type = nextUint32();
        const lexsize = nextUint32();
        const leftSize = nextUint32();
        const rightSize = nextUint32();
        const doubleArraySize = nextUint32();
        const tokensSize = nextUint32();
        const featuresSize = nextUint32();
        const dummy = nextUint32();

        this.charSet = String.fromCharCode(...dicArray.subarray(index, index + 32));
        index += 32;

        // load double array

        const dlimit = index + doubleArraySize;

        while (index < dlimit) {
            const [b1, b2, b3, b4, b5, b6, b7, b8] = dicArray.subarray(index, index + 8);
            index += 8;

            const base = b1
                | (b2 << 8)
                | (b3 << 16)
                | (b4 << 24);

            const check = b5
                | (b6 << 8)
                | (b7 << 16)
                | (b8 << 24) >>> 0;

            this.doubleArray.push({ base, check });
        }

        // Load tokens

        const tlimit = index + tokensSize;

        while (index < tlimit) {
            const leftId = nextUint16();
            const rightId = nextUint16();
            const posId = nextUint16();
            const weight = nextInt16();
            const feature = nextUint32();
            const compound = nextUint32();

            if (leftId > leftSize || rightId > rightSize)
                throw new Error("Token id is invalid")

            if (feature >= featuresSize)
                throw new Error(`Token feature index is out of range ${feature} >= ${featuresSize}`)

            this.tokens.push({
                leftId,
                rightId,
                posId,
                weight,
                feature,
                compound,
            });
        }

        // Load features

        this.featuresArray = dicArray.subarray(index, index + featuresSize);
        index += featuresSize;

        if (index < dicArray.length) {
            throw new Error(`Dictionary is invalid (extranous bytes at end of file) ${index} != ${dicArray.length}`)
        }
    }

    /**
     * @param {Uint16Array} array 
     */
    loadMatrix(array) {
        this.leftSize = array[0];
        this.rightSize = array[1];

        if (array.length != this.leftSize * this.rightSize + 2) {
            throw new Error("Matrix size is not correct");
        }

        this.matrix = new Int16Array(array).subarray(2, this.leftSize * this.rightSize + 2);
    }

    /**
     * @param {number} rightId
     * @param {number} leftId
     * @returns {number}
     */
    getCost(rightId, leftId) {
        if (rightId > this.rightSize) {
            throw new Error(`Right Id is out of bounds (${rightId} > ${this.rightSize})`);
        } else if (leftId > this.leftSize) {
            throw new Error(`Left Id is out of bounds (${leftId} > ${this.leftSize})`);
        }
        return this.matrix[leftId * this.leftSize + rightId];
    }

    /**
     * @param {Uint8Array} array
     * @returns {Result[]}
     */
    prefixResults(array, length = array.length) {
        const results = [];
        let base = this.doubleArray[0].base;

        for (let index = 0; index < length; ++index) {
            const unit = this.doubleArray[base];
            const n = unit.base;

            if (base === unit.check && n < 0) {
                results.push({ value: -n - 1, length: index })
            }

            const unit2 = this.doubleArray[base + array[index] + 1]

            if (base === unit2.check) {
                base = unit2.base;
            } else {
                return results;
            }
        }

        const unit = this.doubleArray[base];
        const n = unit.base;

        if (base == unit.check) {
            results.push({ value: -n - 1, length })
        }

        return results;
    }

    /**
     * @param {number} value
     * @returns {Token[]}
     */
    getTokens(value) {
        const [offset, length] = [value >>> 8, value & 0xFF];
        return this.tokens.slice(offset, offset + length);
    }

    /**
     * @param {Uint8Array} array 
     * @param {number} index 
     * @returns {{end: number, token: Token}[]}
     */
    prefixTokens(array, index) {
        const subarray = array.subarray(index);
        return this.prefixResults(subarray).flatMap(result => {
            const tokens = this.getTokens(result.value);
            return tokens.map(token => ({ end: index + result.length, token }));
        });
    }

    /**
     * @param {Uint8Array} buf 
     * @returns {ParseNode}
     */
    parse(buf) {
        /** @type {Map<number, ParseNode>[]} */
        const nodes = Array(buf.length + 1);

        for (let i = 0; i <= buf.length; ++i)
            nodes[i] = new Map();

        nodes[0].set(0, {
            previous: null,
            start: 0, end: 0,
            token: { leftId: 0, rightId: 0, weight: 0, posId: 0, feature: 0, compound: 0 },
            cost: 0
        });

        for (let index = 0; index <= buf.length; ++index) {
            for (const nextNode of this.prefixTokens(buf, index)) {
                for (const [rightId, previousNode] of nodes[index]) {
                    const edgeCost = this.getCost(rightId, nextNode.token.leftId);
                    const total = previousNode.cost + edgeCost + nextNode.token.weight;

                    const x = nodes[nextNode.end].get(nextNode.token.rightId)?.cost ?? Number.POSITIVE_INFINITY;
                    if (total < x) {
                        nodes[nextNode.end].set(nextNode.token.rightId, {
                            previous: previousNode,
                            start: index, end: nextNode.end,
                            token: nextNode.token,
                            cost: total
                        });
                    }
                }
            }
        }

        let min = null;
        for (const val of nodes[nodes.length - 1].values()) {
            if (!min || val.cost < min.cost) {
                min = val;
            }
        }

        if (!min) throw new Error("No parse");

        return min;
    }

    /**
     * @param {number} index
     * @returns {Uint8Array}
     */
    getFeatures(index) {
        if (index > this.featuresArray.length) {
            throw new Error(`Feature index is out of bounds (${index} > ${this.featuresArray.length})`)
        }
        const nullIndex = this.featuresArray.indexOf(0, index);
        return this.featuresArray.subarray(index, nullIndex);
    }
}

export const mecabDict = new MecabDict();
mecabDict.loadDictionary(new Uint8Array(dicBuffer));
mecabDict.loadMatrix(new Uint16Array(matrixBuffer));

/**
 * @param {Uint8Array} buf
 * @param {ParseNode} node 
 */
export function backtrace(buf, node) {
    const decoder = new TextDecoder();
    const result = [];

    while (node.previous != null) {
        result.push({
            str: decoder.decode(buf.subarray(node.previous.end, node.end)),
            right: node.token.rightId,
            cost: node.cost
        });
        node = node.previous;
    }

    return result.reverse();
}

/**
 * @param {string} str 
 */
export function mecabParse(str) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const buf = encoder.encode(str);

    const result = [];

    let node = mecabDict.parse(buf);
    while (node.previous != null) {
        const substr = decoder.decode(buf.subarray(node.previous.end, node.end));
        const features = decoder.decode(mecabDict.getFeatures(node.token.feature))
            .split(',')
            .map(x => x.trim());

        result.push({
            str: substr,
            pos: features[0],
            pos_detail1: features[1],
            dictionary: features[10],
            features,
        });
        node = node.previous;
    }

    return result.reverse();
}