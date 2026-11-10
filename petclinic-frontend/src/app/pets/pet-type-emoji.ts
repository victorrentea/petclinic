const EMOJI_BY_PET_TYPE: Record<string, string> = {
  cat: '🐱',
  dog: '🐶',
  lizard: '🦎',
  snake: '🐍',
  bird: '🐦',
  hamster: '🐹',
  horse: '🐴'
};

export function petTypeEmoji(typeName: string | undefined): string {
  const type = typeName?.toLowerCase();
  return type && Object.prototype.hasOwnProperty.call(EMOJI_BY_PET_TYPE, type) ? EMOJI_BY_PET_TYPE[type] : '🐾';
}
