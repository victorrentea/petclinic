// https://kata-log.rocks/string-calculator-kata

import { add } from './calculator';

describe('String Calculator', () => {
    it('should return 0 for empty string', () => {
        expect(add("")).toBe(0);
    });
    it('should return the number for a single number string', () => {
        expect(add("1")).toBe(1);
    });
    it('should return the sum of two numbers in a string', () => {
        expect(add("1,2")).toBe(3);
    });
    it('should return the sum of multiple numbers in a string', () => {
        expect(add("1\n2,3")).toBe(6);
    });


});
