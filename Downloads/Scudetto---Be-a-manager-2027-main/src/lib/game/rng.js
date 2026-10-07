export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export class Rng {
    next;
    constructor(seed) {
        this.next = mulberry32(seed);
    }
    float() {
        return this.next();
    }
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    pick(arr) {
        return arr[this.int(0, arr.length - 1)];
    }
    chance(p) {
        return this.next() < p;
    }
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    poisson(lambda) {
        const L = Math.exp(-Math.max(0.05, lambda));
        let k = 0;
        let p = 1;
        do {
            k += 1;
            p *= this.next();
        } while (p > L);
        return k - 1;
    }
}
