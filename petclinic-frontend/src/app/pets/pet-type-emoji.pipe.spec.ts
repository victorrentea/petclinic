import {PetTypeEmojiPipe} from './pet-type-emoji.pipe';

describe('PetTypeEmojiPipe', () => {
  const pipe = new PetTypeEmojiPipe();

  it('draws every pet type in the reference data', () => {
    expect(['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse'].map(type => pipe.transform(type)))
      .toEqual(['🐱', '🐶', '🦎', '🐍', '🐦', '🐹', '🐴']);
  });

  it('ignores case', () => {
    expect(pipe.transform('Cat')).toBe('🐱');
  });

  it('falls back to a paw print for a type added later', () => {
    expect(pipe.transform('axolotl')).toBe('🐾');
    expect(pipe.transform(undefined)).toBe('🐾');
  });
});
