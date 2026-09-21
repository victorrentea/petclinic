import { Injectable } from '@angular/core';
import { Owner, OwnerPage } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

/** Everything the paged owner list endpoint takes. All four have server-side defaults. */
export interface OwnerQuery {
  lastName?: string;
  page?: number;
  size?: number;
  /** `<key>,<asc|desc>` with key in {name, city} — the server rejects anything else. */
  sort?: string;
}

const EMPTY_PAGE: OwnerPage = {content: [], totalElements: 0, totalPages: 0, number: 0, size: 10};

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

  /** The one way to read the owner list: filtered, sorted and paged by the database. */
  listOwners(query: OwnerQuery = {}): Observable<OwnerPage> {
    const params = new HttpParams()
      .set('lastName', query.lastName ?? '')
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? EMPTY_PAGE.size))
      .set('sort', query.sort ?? 'name,asc');
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError('listOwners', EMPTY_PAGE)));
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
