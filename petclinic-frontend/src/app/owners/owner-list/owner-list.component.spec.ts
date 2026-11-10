import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {Observable, of, Subject, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Pet} from '../../pets/pet';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {OwnersModule} from '../owners.module';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query?: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let router: Router;
  let getOwnersSpy: Spy;

  const kevin: Owner = {
    id: 1,
    firstName: 'Kevin',
    lastName: 'McCallister',
    address: '671 Lincoln Blvd.',
    city: 'Winnetka',
    telephone: '6085551023',
    pets: []
  };

  function pageOf(content: Owner[], page: Partial<OwnerPage['page']> = {}): OwnerPage {
    return {content, page: {size: 10, number: 0, totalElements: 26, totalPages: 3, ...page}};
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    }).compileComponents();
    router = TestBed.inject(Router);
    getOwnersSpy = spyOn(TestBed.inject(OwnerService), 'getOwners').and.returnValue(of(pageOf([kevin])));
  });

  async function open(url: string) {
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function urlQueryParams() {
    return router.parseUrl(router.url).queryParams;
  }

  function lastQuery(): OwnerQuery {
    return getOwnersSpy.calls.mostRecent().args[0];
  }

  function header(text: string): HTMLElement {
    return fixture.debugElement.queryAll(By.css('th'))
      .map(th => th.nativeElement as HTMLElement)
      .find(th => th.textContent.trim() === text);
  }

  async function click(element: HTMLElement) {
    element.click();
    fixture.detectChanges();
    await settle();
  }

  async function search(lastName: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#lastName');
    input.value = lastName;
    input.dispatchEvent(new Event('input'));
    await click(fixture.nativeElement.querySelector('#search-owner-form button[type=submit]'));
  }

  it('loads the page (counted from 1 in the URL, from 0 by the API), size, order and filter', async () => {
    await open('/owners?page=2&size=5&sort=city,desc&lastName=Mc');

    expect(lastQuery()).toEqual({page: 1, size: 5, sort: 'city,desc', lastName: 'Mc'});
  });

  it('leaves the defaults to the server when the URL says nothing, showing the order by name', async () => {
    await open('/owners');

    expect(lastQuery()).toEqual({});
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending');
  });

  it('shows "Last, First" in a single Name column linking to the owner', async () => {
    await open('/owners');

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('td.ownerFullName a');
    expect(link.textContent.trim()).toBe('McCallister, Kevin');
    expect(link.getAttribute('href')).toBe('/owners/1');
    expect(fixture.debugElement.queryAll(By.css('thead th')).map(th => th.nativeElement.textContent.trim()))
      .toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
  });

  it('links each pet to its own page', async () => {
    const lassie = {id: 7, name: 'Lassie', type: {id: 2, name: 'dog'}} as Pet;
    getOwnersSpy.and.returnValue(of(pageOf([{...kevin, pets: [lassie]}])));
    await open('/owners');

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('td.ownerPets a');
    expect(link.textContent.trim()).toBe('Lassie');
    expect(link.getAttribute('href')).toBe('/pets/7/edit');
  });

  it('shows an emoji of the pet\'s type before its name, hidden from screen readers', async () => {
    const pets = ['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse', 'axolotl']
      .map((type, index) => ({id: index, name: type, type: {id: index, name: type}}) as Pet);
    getOwnersSpy.and.returnValue(of(pageOf([{...kevin, pets}])));
    await open('/owners');

    const emojis = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('td.ownerPets .pet-type'));
    expect(emojis.map(emoji => emoji.textContent.trim())).toEqual(['🐱', '🐶', '🦎', '🐍', '🐦', '🐹', '🐴', '🐾']);
    expect(emojis.every(emoji => emoji.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(emojis.map(emoji => emoji.dataset.tip))
      .toEqual(['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse', 'axolotl']);
  });

  it('sorts by City ascending, then descending, back on the first page', async () => {
    await open('/owners?page=2&size=5');

    await click(header('City'));
    expect(urlQueryParams()).toEqual({page: '1', size: '5', sort: 'city,asc'});
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 0, sort: 'city,asc'}));

    await click(header('City'));
    expect(urlQueryParams().sort).toBe('city,desc');
  });

  it('shows both arrows on each sortable header, lighting only the current order', async () => {
    await open('/owners?sort=city,desc');

    const lit = (column: string) => Array.from<HTMLElement>(header(column).querySelectorAll('.sort-arrows > span'))
      .map(arrow => `${arrow.classList[0]}${arrow.classList.contains('lit') ? '*' : ''}`);
    expect(lit('City')).toEqual(['up', 'down*']);
    expect(lit('Name')).toEqual(['up', 'down']);
    expect(header('Address').querySelector('.sort-arrows')).toBeNull();
  });

  it('searches from a field whose placeholder names it, with no separate label', async () => {
    await open('/owners');

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#lastName');
    expect(input.placeholder).toBe('Last name');
    expect(input.getAttribute('aria-label')).toBe('Last name');
    expect(fixture.nativeElement.querySelector('#search-owner-form > label, label[for="lastName"]')).toBeNull();
  });

  it('toggles Name between descending and ascending, never back to unsorted', async () => {
    await open('/owners');

    await click(header('Name'));
    expect(urlQueryParams().sort).toBe('name,desc');
    await click(header('Name'));
    expect(urlQueryParams().sort).toBe('name,asc');
    await click(header('Name'));
    expect(urlQueryParams().sort).toBe('name,desc');
  });

  it('does not sort by Address, Telephone or Pets', async () => {
    await open('/owners');
    getOwnersSpy.calls.reset();

    for (const name of ['Address', 'Telephone', 'Pets']) {
      expect(header(name).hasAttribute('mat-sort-header')).toBe(false, name);
      await click(header(name));
    }

    expect(urlQueryParams()).toEqual({});
    expect(getOwnersSpy).not.toHaveBeenCalled();
  });

  it('offers 5, 10 and 20 rows per page and shows the total', async () => {
    await open('/owners');

    expect(optionsOf(pageSizeSelect())).toEqual(['5', '10', '20']);
    expect(selected(pageSizeSelect())).toBe('10');
    expect(rangeLabel()).toBe('1 – 10 of 26');
  });

  it('changing the page size keeps the first visible owner on screen', async () => {
    getOwnersSpy.and.returnValue(of(pageOf([kevin], {number: 4, size: 5, totalPages: 6})));
    await open('/owners?page=5&size=5');

    await choose(pageSizeSelect(), '10');

    // owners 21-25 were on screen; at 10 per page owner 21 is on the third page
    expect(urlQueryParams()).toEqual({page: '3', size: '10'});
  });

  it('jumps to the last page and back to the first', async () => {
    await open('/owners');

    await click(pagerButton('Last page'));
    expect(urlQueryParams()).toEqual(jasmine.objectContaining({page: '3'}));

    getOwnersSpy.and.returnValue(of(pageOf([kevin], {number: 2})));
    await open('/owners?page=3');
    await click(pagerButton('First page'));
    expect(urlQueryParams()).toEqual(jasmine.objectContaining({page: '1'}));
  });

  it('picks a page from the range, showing the current one', async () => {
    getOwnersSpy.and.returnValue(of(pageOf([kevin], {number: 1, size: 5, totalPages: 6})));
    await open('/owners?page=2&size=5');
    expect(rangeLabel()).toBe('6 – 10 of 26');
    expect(optionsOf(pagePicker())).toEqual(['1 – 5', '6 – 10', '11 – 15', '16 – 20', '21 – 25', '26 – 26']);

    await choose(pagePicker(), '16 – 20');

    expect(urlQueryParams()).toEqual({page: '4', size: '5'});
  });

  it('moves to the next page through the URL', async () => {
    await open('/owners?sort=city,asc');

    await click(pagerButton('Next page'));

    expect(urlQueryParams()).toEqual({sort: 'city,asc', page: '2', size: '10'});
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 1, sort: 'city,asc'}));
  });

  // the pager under the table; the one above it shows the same state
  function pager(): HTMLElement {
    const pagers = fixture.nativeElement.querySelectorAll('app-owner-pager');
    return pagers[pagers.length - 1];
  }

  function pageSizeSelect(): HTMLSelectElement {
    return pager().querySelector('.page-size select');
  }

  function pagePicker(): HTMLSelectElement {
    return pager().querySelector('.page-picker select');
  }

  function pagerButton(label: string): HTMLElement {
    return pager().querySelector(`button[aria-label="${label}"]`);
  }

  function optionsOf(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map(option => option.textContent.trim());
  }

  function selected(select: HTMLSelectElement): string {
    return select.options[select.selectedIndex].textContent.trim();
  }

  async function choose(select: HTMLSelectElement, label: string) {
    select.selectedIndex = optionsOf(select).indexOf(label);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle();
  }

  function rangeLabel(): string {
    return `${selected(pagePicker())} ${pager().querySelector('.total').textContent.trim()}`;
  }

  it('a search restarts from the first page, keeping the order and the page size', async () => {
    getOwnersSpy.and.returnValue(of(pageOf([kevin], {number: 3, size: 5, totalPages: 6})));
    await open('/owners?page=4&size=5&sort=city,asc');

    await search('Potter');

    expect(urlQueryParams()).toEqual({page: '1', size: '5', sort: 'city,asc', lastName: 'Potter'});
    expect(lastQuery()).toEqual({page: 0, size: 5, sort: 'city,asc', lastName: 'Potter'});
  });

  it('an empty search drops the filter from the URL', async () => {
    await open('/owners?lastName=Mc');

    await search('');

    expect(urlQueryParams()).toEqual({page: '1'});
  });

  it('moves a page past the end to the last page, replacing the URL', async () => {
    getOwnersSpy.and.callFake((query: OwnerQuery) => of(query.page === 9
      ? pageOf([], {number: 9})
      : pageOf([kevin], {number: query.page})));
    const navigateSpy = spyOn(router, 'navigate').and.callThrough();

    await open('/owners?page=10&size=10');

    expect(navigateSpy).toHaveBeenCalledWith([],
      jasmine.objectContaining({queryParams: {page: 3}, queryParamsHandling: 'merge', replaceUrl: true}));
    expect(urlQueryParams()).toEqual({page: '3', size: '10'});
    expect(lastQuery().page).toBe(2);
  });

  it('says so when no owner matches', async () => {
    getOwnersSpy.and.returnValue(of(pageOf([], {totalElements: 0, totalPages: 0})));

    await open('/owners?lastName=Zzzz');

    expect(fixture.nativeElement.textContent).toContain('No owners with LastName starting with "Zzzz"');
    expect(fixture.nativeElement.querySelector('#ownersTable')).toBeNull();
  });

  // A search typed before an earlier answer arrives must not be overwritten by it when it lands.
  it('only the latest request answers', async () => {
    const initialLoad = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValue(initialLoad);
    await open('/owners');

    getOwnersSpy.and.returnValue(of(pageOf([kevin], {totalElements: 1, totalPages: 1})));
    await search('McCallister');
    initialLoad.next(pageOf([kevin, {...kevin, id: 2, lastName: 'Davis'}]));

    expect(component.owners).toEqual([kevin]);
  });

  it('says why when the list cannot be loaded', async () => {
    getOwnersSpy.and.returnValue(throwError(() => 'Cannot sort by \'telephone\''));
    await open('/owners?sort=telephone');

    expect(fixture.nativeElement.querySelector('.alert-danger').textContent).toContain('Cannot sort by');
  });

  it('ignores a page or size in the URL that is not a number', async () => {
    await open('/owners?page=abc&size=x');

    expect(lastQuery()).toEqual({});
  });

  it('keeps listening to the URL after a failed request', async () => {
    getOwnersSpy.and.returnValue(throwError('server returned code 500'));
    await open('/owners');

    getOwnersSpy.and.returnValue(of(pageOf([kevin])));
    await search('McCallister');

    expect(component.owners).toEqual([kevin]);
  });
});
