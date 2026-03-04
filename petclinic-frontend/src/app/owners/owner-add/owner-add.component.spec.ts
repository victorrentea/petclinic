/* tslint:disable:no-unused-variable */

import { async, ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { OwnerAddComponent } from './owner-add.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { RouterTestingModule } from '@angular/router/testing';
import { RouterStub } from '../../testing/router-stubs';
import { Owner } from '../owner';
import { Observable, of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { OwnersRoutingModule } from '../owners-routing.module';
import { OwnerListComponent } from '../owner-list/owner-list.component';

class OwnserServiceStub {
  addOwner(owner: Owner): Observable<Owner> {
    return of(owner);
  }
}

describe('OwnerAddComponent', () => {
  let component: OwnerAddComponent;
  let fixture: ComponentFixture<OwnerAddComponent>;
  let router: Router;
  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [OwnerAddComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        imports: [FormsModule, RouterTestingModule],
        providers: [
          { provide: OwnerService, useClass: OwnserServiceStub },
          { provide: Router, useClass: RouterStub },
        ],
      }).compileComponents();
    })
  );

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [OwnerAddComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        imports: [FormsModule, RouterTestingModule],
        providers: [
          { provide: OwnerService, useClass: OwnserServiceStub },
          { provide: Router, useClass: RouterStub },
        ],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    router=TestBed.get(Router);
    spyOn(router,'navigate');
  });

  it('should create OwnerAddComponent', () => {
    expect(component).toBeTruthy();
  });

  

  it('back button routing', async() => {
    let buttons = fixture.debugElement.queryAll(By.css('button'));
    let backbutton = buttons[0];
    backbutton.triggerEventHandler('click', null);
    spyOn(component, 'gotoOwnersList').and.callThrough();
    expect(router.navigate).toHaveBeenCalledWith(['/owners']);
  });

 
  it('add owner', async(() => {
    let buttons = fixture.debugElement.queryAll(By.css('button'));
    let addOwnerButton = buttons[1].nativeElement;
    spyOn(component, 'onSubmit');
    addOwnerButton.click();
    expect(component.onSubmit).toHaveBeenCalled();
  }));

});
