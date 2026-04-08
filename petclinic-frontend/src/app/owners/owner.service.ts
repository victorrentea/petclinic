import { Injectable } from '@angular/core';
import { Owner, OwnerPage } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

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

  getOwners(page = 0, size = 20, sort?: string[]): Observable<OwnerPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    sort?.forEach(s => params = params.append('sort', s));
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError('getOwners', {content: [], totalElements: 0, totalPages: 0, number: 0, size} as OwnerPage)));
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

  searchOwners(lastName: string, page = 0, size = 20, sort?: string[]): Observable<OwnerPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (lastName) params = params.set('lastName', lastName);
    sort?.forEach(s => params = params.append('sort', s));
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError('searchOwners', {content: [], totalElements: 0, totalPages: 0, number: 0, size} as OwnerPage)));
  }
}
