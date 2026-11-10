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
  return EMOJI_BY_PET_TYPE[typeName?.toLowerCase()] ?? '🐾';
}
