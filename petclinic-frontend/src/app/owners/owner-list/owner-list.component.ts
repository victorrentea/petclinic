import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, finalize, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string = '';
  searchText: string = '';
  owners: Owner[] = [];
  isOwnersDataReceived: boolean = false;

  private searchSubject = new Subject<string>();

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.ownerService.getOwners().pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      owners => { this.owners = owners; },
      error => this.errorMessage = error as any);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(searchText => this.ownerService.searchOwners(searchText))
    ).subscribe(
      owners => this.owners = owners,
      error => this.errorMessage = error as any
    );
  }

  ngOnDestroy() {
    this.searchSubject.complete();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchTermChange(searchText: string) {
    if (!searchText) {
      this.ownerService.getOwners()
        .subscribe(
          owners => this.owners = owners,
          error => this.errorMessage = error as any
        );
      return;
    }
    this.searchSubject.next(searchText);
  }
}
