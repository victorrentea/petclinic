import { Injectable } from '@angular/core';

/** Where the Owners grid was last left — page, sort and search — for the owner page's Back. */
@Injectable({ providedIn: 'root' })
export class OwnerGridState {
  url = '/owners';
}
