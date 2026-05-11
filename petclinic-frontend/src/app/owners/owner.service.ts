import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnerPage {
  content: Owner[];
  totalElements: number;
}

export type SortField = 'name' | 'city';
export type SortDir = 'asc' | 'desc';

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

  searchOwnersPaged(
    q: string,
    page: number,
    size: number,
    sort: SortField,
    dir: SortDir
  ): Observable<OwnerPage> {
    const params = new HttpParams()
      .set('q', q)
      .set('page', String(page))
      .set('size', String(size))
      .set('sort', sort)
      .set('dir', dir);
    const emptyPage: OwnerPage = { content: [], totalElements: 0 };
    return this.http
      .get<OwnerPage>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('searchOwnersPaged', emptyPage)));
  }

  getOwners(): Observable<Owner[]> {
    return this.http
      .get<Owner[]>(this.entityUrl)
      .pipe(catchError(this.handlerError('getOwners', [])));
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
