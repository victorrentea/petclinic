
export function add(s: string): number {
    if (s.trim() === '') {
        return 0;
    }
    let delimiter = /,|\n/;
     if (s.startsWith("//")) {
        const delimiterEndIndex = s.indexOf("\n");
        delimiter = new RegExp(s.substring(2, delimiterEndIndex));
        s = s.substring(delimiterEndIndex + 1); 
    }
    const parts = s.split(delimiter);
    if (parts.some(part => part.trim() === '')) {
        throw new Error("Invalid input: empty number");
    }
    const numbers = parts.map(Number);
    if (numbers.some(num => num < 0)) {
        throw new Error("Negative numbers are not allowed");
    }
    return numbers.reduce((acc, num) => acc + num, 0);
}