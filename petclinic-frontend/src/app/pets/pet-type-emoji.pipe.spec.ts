import {PetTypeEmojiPipe} from './pet-type-emoji.pipe';

describe('PetTypeEmojiPipe', () => {
  const pipe = new PetTypeEmojiPipe();

  it('maps every reference pet type to its emoji', () => {
    expect(['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse'].map(t => pipe.transform(t)))
      .toEqual(['🐱', '🐶', '🦎', '🐍', '🐦', '🐹', '🐴']);
  });

  it('ignores case', () => {
    expect(pipe.transform('Dog')).toBe('🐶');
  });

  it('falls back to a paw print for a type it does not know, or none', () => {
    expect(pipe.transform('axolotl')).toBe('🐾');
    expect(pipe.transform(undefined)).toBe('🐾');
  });
});
