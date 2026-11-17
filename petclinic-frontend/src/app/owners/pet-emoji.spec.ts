import {petEmoji} from './pet-emoji';

describe('petEmoji', () => {
  it('has an emoji for every pet type of the clinic', () => {
    expect(['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse'].map(petEmoji))
      .toEqual(['🐱', '🐶', '🦎', '🐍', '🐦', '🐹', '🐴']);
  });

  it('ignores case and falls back to a paw for an unknown or missing type', () => {
    expect(petEmoji('Dog')).toBe('🐶');
    expect(petEmoji('tarantula')).toBe('🐾');
    expect(petEmoji(undefined)).toBe('🐾');
  });
});
