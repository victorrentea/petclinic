import {Pipe, PipeTransform} from '@angular/core';

const EMOJI_BY_PET_TYPE: Record<string, string> = {
  cat: '🐱',
  dog: '🐶',
  lizard: '🦎',
  snake: '🐍',
  bird: '🐦',
  hamster: '🐹',
  horse: '🐴'
};

/** The emoji for a pet type name (`dog` → 🐶); a type added later without one still gets 🐾. */
@Pipe({name: 'petTypeEmoji'})
export class PetTypeEmojiPipe implements PipeTransform {
  transform(typeName: string | undefined): string {
    return EMOJI_BY_PET_TYPE[typeName?.toLowerCase() ?? ''] ?? '🐾';
  }
}
