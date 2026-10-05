import {Pipe, PipeTransform} from '@angular/core';

/** An owner's name as in a register — "McCallister, Kevin" — matching the grid's sort by last name. */
@Pipe({name: 'ownerName'})
export class OwnerNamePipe implements PipeTransform {
  transform(owner: {firstName: string; lastName: string} | undefined): string {
    return owner ? `${owner.lastName}, ${owner.firstName}` : '';
  }
}
