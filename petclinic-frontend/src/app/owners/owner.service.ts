import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage, OwnerSearchCriteria } from './owner-row';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

const EMPTY_PAGE: OwnerPage = {
  content: [],
  page: { size: 0, number: 0, totalElements: 0, totalPages: 0 }
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
   * One page of the owners grid. Replaces the old getOwners()/searchOwners() pair, which were
   * the same call with and without a query string.
   */
  findOwners(criteria: OwnerSearchCriteria): Observable<OwnerPage> {
    const params = new HttpParams()
      .set('lastName', criteria.lastName)
      .set('page', criteria.page)
      .set('size', criteria.size)
      .set('sort', criteria.sort)
      .set('dir', criteria.dir);
    return this.http
      .get<OwnerPage>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('findOwners', EMPTY_PAGE)));
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
