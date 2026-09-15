import { Pipe, PipeTransform } from '@angular/core';

interface HasOwnerName {
  firstName?: string | null;
  lastName?: string | null;
}

/** Renders an owner's name as "Last, First" everywhere the UI shows one. */
@Pipe({ name: 'ownerName', pure: true })
export class OwnerNamePipe implements PipeTransform {
  transform(owner: HasOwnerName): string {
    const first = owner.firstName || '';
    const last = owner.lastName || '';
    if (first && last) {
      return `${last}, ${first}`;
    }
    return last || first;
  }
}
