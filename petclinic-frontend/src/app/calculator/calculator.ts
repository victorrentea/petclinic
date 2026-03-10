
export function add(s: string): number {
    if (s === "") {
        return 0;
    }
    if (s.includes(",")) {
        const numbers = s.split(",").map(Number);
        return numbers.reduce((a, b) => a + b, 0);
    }

    return parseInt(s);
}


