import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnersPageParams {
  page: number;
  size: number;
  sort: string;
  dir: string;
  lastName: string;
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

  getOwnersPage(params: OwnersPageParams): Observable<OwnerPage> {
    const httpParams = new HttpParams()
      .set('page', params.page)
      .set('size', params.size)
      .set('sort', params.sort)
      .set('dir', params.dir)
      .set('lastName', params.lastName);
    return this.http.get<OwnerPage>(this.entityUrl, { params: httpParams });
  }

  searchOwners(lastName: string): Observable<Owner[]> {
    let url = this.entityUrl;
    if (lastName !== undefined) {
      url += '?lastName=' + lastName;
    }
    return this.http
      .get<Owner[]>(url)
      .pipe(catchError(this.handlerError('searchOwners', [])));
  }
}
