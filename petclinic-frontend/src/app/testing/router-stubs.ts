// export for convenience.
export {ActivatedRoute, Router, RouterLink, RouterOutlet} from '@angular/router';

import {Component, Directive, HostListener, Injectable, Input} from '@angular/core';
import {NavigationExtras} from '@angular/router';
// Only implements params and part of snapshot.params
import {BehaviorSubject} from 'rxjs';

@Directive({
  selector: '[appRouterLink]',
})
export class RouterLinkStubDirective {
  @Input() linkParams: any;
  navigatedTo: any = null;

  @HostListener('click', ['$event'])
  onClick() {
    this.navigatedTo = this.linkParams;
  }
}

@Component({selector: 'app-router-outlet', template: ''})
export class RouterOutletStubComponent {
}

@Injectable()
export class RouterStub {
  navigate(commands: any[], extras?: NavigationExtras) {
  }
}


@Injectable()
export class ActivatedRouteStub {

  // Test parameters
  // tslint:disable-next-line:variable-name
  private _testParams: {};

  // Test query parameters
  // tslint:disable-next-line:variable-name
  private _testQueryParams: {} = {};

  // ActivatedRoute.params is Observable
  private subject = new BehaviorSubject(this.testParams);
  params = this.subject.asObservable();

  // ActivatedRoute.queryParams is Observable
  private queryParamsSubject = new BehaviorSubject(this.testQueryParams);
  queryParams = this.queryParamsSubject.asObservable();

  get testParams() {
    return this._testParams;
  }

  set testParams(params: {}) {
    this._testParams = params;
    this.subject.next(params);
  }

  get testQueryParams() {
    return this._testQueryParams;
  }

  set testQueryParams(params: {}) {
    this._testQueryParams = params;
    this.queryParamsSubject.next(params);
  }

  // ActivatedRoute.snapshot.params
  get snapshot() {
    this.testParams = {id: 1};
    return {params: this.testParams, queryParams: this.testQueryParams};
  }
}
