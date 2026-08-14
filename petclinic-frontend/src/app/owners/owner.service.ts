import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import { components, operations } from '../generated/api-types';

/**
 * The view state of the owners grid, and exactly what the list endpoint accepts - taken from
 * the generated contract, so a new query parameter cannot leave this type silently stale.
 * `sort` is `<field>,<asc|desc>` with field in name | city | petCount.
 */
export type OwnerQuery = Required<NonNullable<operations['listOwners']['parameters']['query']>>;

export type OwnerPage = Omit<components['schemas']['OwnerPageDto'], 'content'> & {
  content: Owner[];
};

@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  /**
   * Deliberately without catchError: the grid must tell a failed request apart from an empty
   * result, which is impossible once a failure is masked as an empty page.
   */
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    return this.http.get<OwnerPage>(this.entityUrl, { params: { ...query } });
  }

  getOwnerById(ownerId: number): Observable<Owner> {
    return this.http
      .get<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('getOwnerById', {} as Owner)));
  }

  addOwner(owner: Owner): Observable<Owner> {
    return this.http
      .post<Owner>(this.entityUrl, owner)
      .pipe(catchError(this.handlerError('addOwner', owner)));
  }


  updateOwner(ownerId: string, owner: Owner): Observable<{}> {
    return this.http
      .put<Owner>(this.entityUrl + '/' + ownerId, owner)
      .pipe(catchError(this.handlerError('updateOwner', owner)));
  }

  deleteOwner(ownerId: string): Observable<{}> {
    return this.http
      .delete<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('deleteOwner', [ownerId])));
  }
}
