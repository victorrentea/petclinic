import { Injectable } from '@angular/core';
import { Owner, OwnerPage } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

/** The only page sizes `GET /api/owners` accepts; anything else is a 400. */
export const OWNERS_PAGE_SIZES = [5, 10, 20];
export const DEFAULT_OWNERS_PAGE_SIZE = 10;
export const DEFAULT_OWNERS_SORT = 'lastName,asc';

export interface OwnersQuery {
  page?: number;
  size?: number;
  /** `{lastName|firstName|city},{asc|desc}` — any other property is a 400. */
  sort?: string;
  lastName?: string;
}

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

  getOwners(query: OwnersQuery = {}): Observable<OwnerPage> {
    const page = query.page || 0;
    const size = query.size || DEFAULT_OWNERS_PAGE_SIZE;
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', query.sort || DEFAULT_OWNERS_SORT);
    if (query.lastName) {
      params = params.set('lastName', query.lastName);
    }
    return this.http
      .get<OwnerPage>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('getOwners', emptyOwnerPage(page, size))));
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

function emptyOwnerPage(number: number, size: number): OwnerPage {
  return { content: [], page: { size, number, totalElements: 0, totalPages: 0 } };
}
