import {Pipe, PipeTransform} from '@angular/core';

// Keyed by the names in db/reference/R__reference.sql; a type added there later gets the paw print.
const EMOJI_BY_PET_TYPE: {[petType: string]: string} = {
  cat: '🐱',
  dog: '🐶',
  lizard: '🦎',
  snake: '🐍',
  bird: '🐦',
  hamster: '🐹',
  horse: '🐴'
};

@Pipe({name: 'petTypeEmoji'})
export class PetTypeEmojiPipe implements PipeTransform {
  transform(petTypeName: string | undefined): string {
    return EMOJI_BY_PET_TYPE[petTypeName?.toLowerCase()] ?? '🐾';
  }
}
