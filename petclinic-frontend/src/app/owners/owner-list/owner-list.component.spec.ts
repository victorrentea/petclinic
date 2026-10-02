import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {RouterTestingModule} from '@angular/router/testing';
import {ActivatedRoute, convertToParamMap, ParamMap, Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule} from '@angular/material/sort';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatPaginatorHarness} from '@angular/material/paginator/testing';
import {MatSortHeaderHarness} from '@angular/material/sort/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';
import {Owner} from '../owner';

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let service: jasmine.SpyObj<OwnerService>;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: jasmine.Spy;
  const owner: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin',
    address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: []
  };
  const page: OwnerPage = {content: [owner], totalElements: 26};

  beforeEach(waitForAsync(() => {
    service = jasmine.createSpyObj<OwnerService>('OwnerService', ['getOwners', 'searchOwners']);
    service.getOwners.and.returnValue(of(page));
    service.searchOwners.and.returnValue(of(page));
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [
        CommonModule, FormsModule, RouterTestingModule, NoopAnimationsModule,
        MatPaginatorModule, MatSortModule
      ],
      providers: [{provide: OwnerService, useValue: service}]
    }).compileComponents();
  }));

  beforeEach(() => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    const route = TestBed.inject(ActivatedRoute);
    spyOnProperty(route, 'queryParamMap', 'get').and.returnValue(queryParams.asObservable());
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.callFake((commands, extras) => {
      if (extras?.queryParams) {
        queryParams.next(convertToParamMap(extras.queryParams));
      }
      return Promise.resolve(true);
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  const paginator = () => fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
  const sort = () => fixture.debugElement.query(By.directive(MatSort)).injector.get(MatSort);
  const text = () => (fixture.nativeElement as HTMLElement).textContent;
  const renderedPaginator = () => TestbedHarnessEnvironment.loader(fixture).getHarness(MatPaginatorHarness);
  const header = (key: string) => fixture.nativeElement.querySelector(
    `th[mat-sort-header="${key}"]`) as HTMLElement;

  it('loads the initial URL state once and restores the controls and search input', () => {
    queryParams.next(convertToParamMap({page: '2', size: '5', sort: 'city,desc', lastName: 'Pot'}));
    fixture.detectChanges();
    expect(service.getOwners).not.toHaveBeenCalled();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 2, 5, 'city,desc');
    expect(component.lastName).toBe('Pot');
    expect(paginator().pageIndex).toBe(2);
    expect(paginator().pageSize).toBe(5);
    expect(sort().active).toBe('city');
    expect(sort().direction).toBe('desc');
  });

  it('writes applied settings to the URL while leaving draft text out of paging', () => {
    fixture.detectChanges();
    component.searchByLastName('Pot');
    component.lastName = 'Draft';
    component.onPageChange({pageIndex: 1, pageSize: 10, length: 26});
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {page: 1, size: 10, sort: 'name,asc', lastName: 'Pot'}
    }));
    expect(component.lastName).toBe('Draft');
    expect(service.searchOwners).toHaveBeenCalledWith('Pot', 1, 10, 'name,asc');
  });

  it('restores route changes and does not reload an unchanged applied state', () => {
    fixture.detectChanges();
    service.getOwners.calls.reset();
    queryParams.next(convertToParamMap({page: '1', size: '5', sort: 'city,desc'}));
    queryParams.next(convertToParamMap({page: '1', size: '5', sort: 'city,desc', unrelated: 'value'}));
    expect(service.getOwners).toHaveBeenCalledOnceWith(1, 5, 'city,desc');
    queryParams.next(convertToParamMap({lastName: 'Pot'}));
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, 'name,asc');
    expect(component.lastName).toBe('Pot');
  });

  for (const invalid of [
    {page: '-1'}, {page: 'abc'}, {page: ''}, {page: '1.5'}, {page: '2147483648'},
    {page: '2147483647'}, {size: '7'}, {size: ''}, {sort: 'telephone,asc'}, {sort: ''},
    {sort: 'name,up'}, {sort: 'name,asc,id'}, {page: ['0', '1']}, {lastName: ['Pot', 'Dar']}
  ]) {
    it(`replaces invalid URL settings ${JSON.stringify(invalid)} with defaults and a notice`, () => {
      queryParams.next(convertToParamMap({lastName: 'Pot', sort: 'city,desc', ...invalid}));
      fixture.detectChanges();
      expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
      expect(service.searchOwners).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
        replaceUrl: true,
        queryParams: {page: 0, size: 10, sort: 'name,asc', lastName: ''}
      }));
      expect(text()).toContain('Invalid owner-list URL');
      expect(text()).toContain('defaults');
      expect(component.lastName).toBe('');
    });
  }

  it('reloads an identical submitted search once without a duplicate history entry', () => {
    queryParams.next(convertToParamMap({lastName: 'Pot'}));
    fixture.detectChanges();
    service.searchOwners.calls.reset();
    component.searchByLastName('Pot');
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, 'name,asc');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears unsubmitted draft text when an invalid URL resets the applied defaults', () => {
    fixture.detectChanges();
    component.lastName = 'Draft';
    service.getOwners.calls.reset();
    queryParams.next(convertToParamMap({size: '7'}));
    expect(component.lastName).toBe('');
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
  });

  it('cancels obsolete route requests and both subscriptions when destroyed', () => {
    const initial = new Subject<OwnerPage>();
    const latest = new Subject<OwnerPage>();
    service.getOwners.and.returnValues(initial, latest);
    fixture.detectChanges();
    queryParams.next(convertToParamMap({page: '1'}));
    expect(initial.observers.length).toBe(0);
    expect(latest.observers.length).toBe(1);
    expect(component.isOwnersDataReceived).toBeFalse();
    initial.next(page);
    initial.error('Obsolete');
    expect(component.errorMessage).toBe('');
    expect(component.owners).toEqual([]);
    expect(queryParams.observers.length).toBe(1);
    fixture.destroy();
    expect(latest.observers.length).toBe(0);
    expect(queryParams.observers.length).toBe(0);
  });

  it('surfaces failed URL navigation instead of silently keeping a misleading view', async () => {
    fixture.detectChanges();
    spyOn(console, 'error');
    navigate.and.callFake(() => Promise.reject(new Error('Router failed')));
    component.onPageChange({pageIndex: 1, pageSize: 10, length: 26});
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('Unable to update the owner-list URL');
    expect(console.error).toHaveBeenCalled();
  });

  it('renders ten linked rows and only Name/City sorting controls', async () => {
    service.getOwners.and.returnValue(of({
      content: Array.from({length: 10}, (_, index) => ({...owner, id: index + 1})),
      totalElements: 26
    }));
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const headers = await loader.getAllHarnesses(MatSortHeaderHarness);
    expect(await Promise.all(headers.map(control => control.getLabel()))).toEqual(['Name', 'City']);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(10);
    expect(fixture.nativeElement.querySelector('.ownerFullName a').getAttribute('href')).toBe('/owners/1');
    expect(fixture.nativeElement.querySelector('.ownerFullName a').textContent.trim()).toBe('Franklin, George');
    expect(header('name').getAttribute('aria-sort')).toBe('ascending');
    for (const column of ['Address', 'Telephone', 'Pets']) {
      const cell = Array.from(fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>)
        .find(element => element.textContent.trim() === column);
      expect(cell.querySelector('[role="button"]')).toBeNull();
      expect(cell.hasAttribute('mat-sort-header')).toBeFalse();
    }
    const controls = await renderedPaginator();
    expect(await controls.getPageSize()).toBe(10);
    expect(await controls.getRangeLabel()).toBe('1 – 10 of 26');
  });

  it('navigates with rendered buttons and displays accurate ranges and boundaries', async () => {
    fixture.detectChanges();
    const controls = await renderedPaginator();
    expect(await controls.isPreviousPageDisabled()).toBeTrue();
    service.getOwners.calls.reset();
    await controls.goToNextPage();
    expect(service.getOwners).toHaveBeenCalledOnceWith(1, 10, 'name,asc');
    expect(await controls.getRangeLabel()).toBe('11 – 20 of 26');
    service.getOwners.calls.reset();
    await controls.goToPreviousPage();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
    expect(await controls.getRangeLabel()).toBe('1 – 10 of 26');
    service.getOwners.calls.reset();
    await controls.goToLastPage();
    expect(service.getOwners).toHaveBeenCalledOnceWith(2, 10, 'name,asc');
    expect(await controls.getRangeLabel()).toBe('21 – 26 of 26');
    expect(await controls.isNextPageDisabled()).toBeTrue();
    service.getOwners.calls.reset();
    await controls.goToFirstPage();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
  });

  it('offers only 5/10/20 and resets a later page through the rendered size selector', async () => {
    fixture.detectChanges();
    const controls = await renderedPaginator();
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await select.open();
    expect(await Promise.all((await select.getOptions()).map(option => option.getText()))).toEqual(['5', '10', '20']);
    await select.close();
    for (const size of [5, 20, 10]) {
      await controls.goToNextPage();
      service.getOwners.calls.reset();
      await controls.setPageSize(size);
      expect(service.getOwners).toHaveBeenCalledOnceWith(0, size, 'name,asc');
      expect(await controls.getRangeLabel()).toBe(`1 – ${size} of 26`);
    }
  });

  it('toggles rendered headers without clearing sorting and resets the page', async () => {
    fixture.detectChanges();
    const controls = await renderedPaginator();
    const city = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSortHeaderHarness.with({label: 'City'}));
    await controls.goToNextPage();
    for (const direction of ['asc', 'desc', 'asc'] as const) {
      service.getOwners.calls.reset();
      await city.click();
      expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, `city,${direction}`);
      expect(header('city').getAttribute('aria-sort')).toBe(direction === 'asc' ? 'ascending' : 'descending');
      expect(await controls.getRangeLabel()).toBe('1 – 10 of 26');
    }
  });

  it('sorts with Enter and Space on focusable rendered headers using the submitted prefix', async () => {
    fixture.detectChanges();
    component.searchByLastName('Pot');
    component.lastName = 'Draft';
    fixture.detectChanges();
    const controls = await renderedPaginator();
    await controls.goToNextPage();
    for (const action of [
      {column: 'city', key: 'Enter', keyCode: 13, expected: 'city,asc'},
      {column: 'city', key: ' ', keyCode: 32, expected: 'city,desc'},
      {column: 'name', key: 'Enter', keyCode: 13, expected: 'name,asc'}
    ] as const) {
      service.searchOwners.calls.reset();
      const button = header(action.column).querySelector('[role="button"]') as HTMLElement;
      button.focus();
      expect(document.activeElement).toBe(button);
      button.dispatchEvent(new KeyboardEvent('keydown', {
        key: action.key, keyCode: action.keyCode, bubbles: true
      }));
      fixture.detectChanges();
      expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, action.expected);
      expect(await controls.getRangeLabel()).toBe('1 – 10 of 26');
    }
  });

  it('submits once from the rendered button and once from the form while retaining sort', async () => {
    fixture.detectChanges();
    const city = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSortHeaderHarness.with({label: 'City'}));
    await city.click();
    await city.click();
    await (await renderedPaginator()).goToNextPage();
    const input = fixture.nativeElement.querySelector('#lastName') as HTMLInputElement;
    input.value = 'Pot';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, 'city,desc');
    input.value = 'Dar';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await fixture.whenStable();
    service.searchOwners.calls.reset();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    fixture.detectChanges();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Dar', 0, 10, 'city,desc');
  });

  it('loads one default page and displays owner links, total and controls', () => {
    fixture.detectChanges();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
    expect(text()).toContain('Franklin, George');
    expect(text()).toContain('of 26');
    expect(paginator().pageSizeOptions).toEqual([5, 10, 20]);
    expect(paginator().showFirstLastButtons).toBeTrue();
    expect(sort().active).toBe('name');
    expect(sort().disableClear).toBeTrue();
    expect(Array.from(sort().sortables.keys())).toEqual(['name', 'city']);
  });

  it('requests exactly one next page and resets to page zero when size changes', () => {
    fixture.detectChanges();
    service.getOwners.calls.reset();
    paginator().nextPage();
    fixture.detectChanges();
    expect(service.getOwners).toHaveBeenCalledOnceWith(1, 10, 'name,asc');
    service.getOwners.calls.reset();
    paginator().page.emit({pageIndex: 1, pageSize: 5, length: 26});
    fixture.detectChanges();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 5, 'name,asc');
    expect(paginator().pageIndex).toBe(0);
  });

  it('keeps rendered rows in place while sorting loads their replacement', () => {
    fixture.detectChanges();
    const result = new Subject<OwnerPage>();
    service.getOwners.and.returnValue(result);
    component.onSortChange({active: 'city', direction: 'desc'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(text()).toContain('Franklin, George');
    expect(fixture.nativeElement.querySelector('table').getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    result.next({content: [{...owner, lastName: 'Potter', firstName: 'Harry'}], totalElements: 26});
    result.complete();
    fixture.detectChanges();
    expect(text()).toContain('Potter, Harry');
    expect(text()).not.toContain('Franklin, George');
    expect(fixture.nativeElement.querySelector('table').getAttribute('aria-busy')).toBe('false');
  });

  it('resets sort/search to the first page while preserving the chosen sort', () => {
    fixture.detectChanges();
    paginator().nextPage();
    fixture.detectChanges();
    service.getOwners.calls.reset();
    sort().sortChange.emit({active: 'city', direction: 'desc'});
    fixture.detectChanges();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'city,desc');
    component.searchByLastName('Pot');
    fixture.detectChanges();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, 'city,desc');
    expect(paginator().pageIndex).toBe(0);
  });

  it('keeps the submitted prefix while draft input changes and sends one form request', () => {
    fixture.detectChanges();
    component.lastName = 'Pot';
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 0, 10, 'name,asc');
    component.lastName = 'Dar';
    service.searchOwners.calls.reset();
    paginator().nextPage();
    expect(service.searchOwners).toHaveBeenCalledOnceWith('Pot', 1, 10, 'name,asc');
  });

  it('clearing the search requests an unfiltered first page', () => {
    fixture.detectChanges();
    component.searchByLastName('Pot');
    service.getOwners.calls.reset();
    component.searchByLastName('');
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
  });

  it('ignores stale rows and errors without prematurely finishing the latest request', () => {
    const initial = new Subject<OwnerPage>();
    const latest = new Subject<OwnerPage>();
    service.getOwners.and.returnValue(initial);
    service.searchOwners.and.returnValue(latest);
    fixture.detectChanges();
    component.searchByLastName('Pot');
    initial.next(page);
    initial.error('Obsolete error');
    fixture.detectChanges();
    expect(text()).toContain('Loading');
    expect(text()).not.toContain('Obsolete error');
    expect(text()).not.toContain('Franklin, George');
    latest.next({content: [], totalElements: 0});
    latest.complete();
    fixture.detectChanges();
    expect(text()).not.toContain('Loading');
    expect(text()).toContain('No owners');
  });

  it('cancels outstanding requests on destruction', () => {
    const initial = new Subject<OwnerPage>();
    service.getOwners.and.returnValue(initial);
    fixture.detectChanges();
    expect(initial.observers.length).toBe(1);
    fixture.destroy();
    expect(initial.observers.length).toBe(0);
  });

  it('shows no matches only for a successful zero-total result and keeps Add Owner', () => {
    service.searchOwners.and.returnValue(of({content: [], totalElements: 0}));
    fixture.detectChanges();
    component.searchByLastName('Nobody');
    fixture.detectChanges();
    expect(text()).toContain('No owners with last name starting with "Nobody"');
    expect(fixture.debugElement.query(By.directive(MatPaginator))).toBeNull();
    expect(text()).toContain('Add Owner');
  });

  it('keeps navigation when an empty page still has matches', () => {
    service.getOwners.and.returnValue(of({content: [], totalElements: 26}));
    fixture.detectChanges();
    expect(text()).not.toContain('No owners');
    expect(paginator().length).toBe(26);
  });

  it('recovers from a nonzero-total empty page with the rendered previous button', async () => {
    fixture.detectChanges();
    const controls = await renderedPaginator();
    service.getOwners.and.returnValue(of({content: [], totalElements: 26}));
    await controls.goToNextPage();
    expect(text()).not.toContain('No owners');
    expect(await controls.isPreviousPageDisabled()).toBeFalse();
    service.getOwners.and.returnValue(of(page));
    service.getOwners.calls.reset();
    await controls.goToPreviousPage();
    expect(service.getOwners).toHaveBeenCalledOnceWith(0, 10, 'name,asc');
    expect(text()).toContain('Franklin, George');
  });

  it('uses the submitted prefix in the empty view despite unsubmitted input edits', () => {
    const result = new Subject<OwnerPage>();
    service.searchOwners.and.returnValue(result);
    fixture.detectChanges();
    component.searchByLastName('Nobody');
    component.lastName = 'Draft';
    result.next({content: [], totalElements: 0});
    result.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('No owners with last name starting with "Nobody"');
    expect(fixture.debugElement.query(By.directive(MatPaginator))).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('hides stale pagination after a failed search without showing no matches', () => {
    service.searchOwners.and.returnValue(throwError('Service unavailable'));
    fixture.detectChanges();
    component.searchByLastName('Pot');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Service unavailable');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(fixture.debugElement.query(By.directive(MatPaginator))).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('displays failures separately from a successful empty result', () => {
    service.getOwners.and.returnValue(throwError('Service unavailable'));
    fixture.detectChanges();
    expect(text()).toContain('Service unavailable');
    expect(text()).not.toContain('No owners');
    expect(text()).toContain('Add Owner');
  });
});
