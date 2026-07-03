import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import { OwnerPage } from './owner-page';

@Injectable()
export class OwnerService {
  private static readonly DEFAULT_SORT = ['lastName,asc', 'firstName,asc', 'id,asc'];
  entityUrl = environment.REST_API_URL + 'owners';

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getOwners(lastName: string = '', page: number = 0, size: number = 5,
            sort: string[] = OwnerService.DEFAULT_SORT): Observable<OwnerPage> {
    let params = new HttpParams()
      .set('lastName', lastName)
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(sortField => {
      params = params.append('sort', sortField);
    });
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError('getOwners', {
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: page,
        size
      } as OwnerPage)));
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

  searchOwners(lastName: string, page: number = 0, size: number = 5,
               sort: string[] = OwnerService.DEFAULT_SORT): Observable<OwnerPage> {
    return this.getOwners(lastName, page, size, sort);
  }
}
