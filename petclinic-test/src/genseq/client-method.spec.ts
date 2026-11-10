import {expect, test} from '@playwright/test';
import {clientMethodOf, maskSource} from './client-method';

// The frontend method a request went through, read back from the source: the stack only
// has the component's `.subscribe(` line, since `http.get` is a cold Observable.

const SERVICE = `
import {HttpClient} from '@angular/common/http';
@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';
  constructor(private http: HttpClient) {}

  getOwners(): Observable<Owner[]> {
    return this.http
      .get<Owner[]>(this.entityUrl)
      .pipe(catchError(this.handlerError('getOwners', [])));
  }

  getOwnerById(ownerId: number): Observable<Owner> {
    return this.http.get<Owner>(this.entityUrl + '/' + ownerId);
  }

  addOwner(owner: Owner): Observable<Owner> {
    return this.http.post<Owner>(this.entityUrl, owner);
  }

  searchOwners(lastName: string): Observable<Owner[]> {
    let url = this.entityUrl;
    if (lastName !== undefined) {
      url += '?lastName=' + lastName;
    }
    return this.http.get<Owner[]>(url).pipe(catchError(this.handlerError('searchOwners', [])));
  }
}
`;

const COMPONENT = `import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Router} from '@angular/router';

export class OwnerListComponent implements OnInit {
  constructor(private router: Router, private ownerService: OwnerService) {
  }

  ngOnInit() {
    this.load = this.ownerService.getOwners().pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      owners => this.owners = owners);
  }

  searchByLastName(lastName: string) {
    this.load?.unsubscribe();
    const owners$ = lastName ? this.ownerService.searchOwners(lastName) : this.ownerService.getOwners();
    this.load = owners$.subscribe(
      owners => this.owners = owners);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  ngOnChanges() {
    this.ownerService.getOwnerById(1).subscribe(owner => {
      this.ownerService.addOwner(owner).subscribe(
        () => {});
    });
  }
}
`;

const ROOT = '/repo/petclinic-frontend';
const COMPONENT_FILE = 'src/app/owners/owner-list/owner-list.component.ts';
const files: Record<string, string> = {
  [`${ROOT}/${COMPONENT_FILE}`]: COMPONENT,
  [`${ROOT}/src/app/owners/owner.service.ts`]: SERVICE,
};
const read = (p: string) => files[p];
const lineOf = (needle: string) => COMPONENT.split('\n').findIndex((l) => l.includes(needle)) + 1;
const frame = (needle: string) => ({file: COMPONENT_FILE, line: lineOf(needle), text: needle});
const URL = 'http://127.0.0.1:8080/api/owners';

test('a subscribe on the service call names the service method', () => {
  expect(clientMethodOf([frame('this.ownerService.getOwnerById(1).subscribe(owner => {')],
    {verb: 'GET', url: `${URL}/1`}, ROOT, read)).toBe('OwnerService.getOwnerById');
});

test('a subscribe at the end of a pipe chain reads the statement back to its start', () => {
  expect(clientMethodOf([frame(').subscribe(')], {verb: 'GET', url: URL}, ROOT, read))
    .toBe('OwnerService.getOwners');
});

test('a call nested in another call’s callback is its own statement', () => {
  expect(clientMethodOf([frame('this.ownerService.addOwner(owner).subscribe(')],
    {verb: 'POST', url: URL}, ROOT, read)).toBe('OwnerService.addOwner');
});

test('a local observable is followed to the assignment that built it, and the URL picks the branch', () => {
  const sent = frame('this.load = owners$.subscribe(');
  expect(clientMethodOf([sent], {verb: 'GET', url: `${URL}?lastName=Dav`}, ROOT, read))
    .toBe('OwnerService.searchOwners');
  expect(clientMethodOf([sent], {verb: 'GET', url: URL}, ROOT, read))
    .toBe('OwnerService.getOwners');
});

test('no service call on the line names the component method it is written in', () => {
  expect(clientMethodOf([frame('this.router.navigate([\'/owners\', owner.id]);')],
    {verb: 'GET', url: URL}, ROOT, read)).toBe('OwnerListComponent.onSelect');
});

test('a line the checkout no longer has is named by file and line, never read into', () => {
  expect(clientMethodOf([{file: COMPONENT_FILE, line: lineOf(').subscribe('), text: 'gone();'}],
    {verb: 'GET', url: URL}, ROOT, read)).toBe(`owner-list.component.ts:${lineOf(').subscribe(')}`);
});

test('no call site, no self-call', () => {
  expect(clientMethodOf([], {verb: 'GET', url: URL}, ROOT, read)).toBeUndefined();
});

test('masking keeps every offset and blanks strings and comments', () => {
  const source = `a('x;y') // b(\n/* c( */ d("e")`;
  const masked = maskSource(source);
  expect(masked.length).toBe(source.length);
  expect(masked).toBe(`a('   ')      \n         d(" ")`);
});
