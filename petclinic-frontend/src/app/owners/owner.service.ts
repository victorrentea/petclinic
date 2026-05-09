import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
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

  getOwners(q?: string): Observable<Owner[]> {
    let httpParams = new HttpParams();
    if (q) {
      httpParams = httpParams.set('q', q);
    }
    return this.http
      .get<{content: Owner[]}>(this.entityUrl, { params: httpParams })
      .pipe(
        map(response => response.content),
        catchError(this.handlerError('getOwners', []))
      );
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

  getOwnerPage(params: { page: number; size: number; sort: string; q?: string }): Observable<OwnerPage> {
    let httpParams = new HttpParams()
      .set('page', params.page.toString())
      .set('size', params.size.toString())
      .set('sort', params.sort);
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<OwnerPage>(this.entityUrl, { params: httpParams });
  }
}
