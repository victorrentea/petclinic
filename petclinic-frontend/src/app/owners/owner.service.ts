import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnerQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}

const NO_OWNERS: OwnerPage = {content: [], totalElements: 0, totalPages: 0, number: 0, size: 0};

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

  /** `query.page` counts from 1, as the URL does; the API counts from 0. */
  getOwnerPage(query: OwnerQuery): Observable<OwnerPage> {
    const params = new HttpParams()
      .set('lastName', query.lastName)
      .set('page', query.page - 1)
      .set('size', query.size)
      .set('sort', query.sort);
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError('getOwnerPage', NO_OWNERS)));
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
