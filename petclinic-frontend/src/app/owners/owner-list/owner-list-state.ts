import {Injectable} from '@angular/core';
import {OwnerQuery} from '../owner-page';

/** The grid's last query, outliving the grid itself: pages that navigate back to it restore it. */
@Injectable({providedIn: 'root'})
export class OwnerListState {
  lastQuery?: OwnerQuery;
}
