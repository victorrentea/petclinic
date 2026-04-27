import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged, finalize, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  query: string = '';
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  private searchSubject = new Subject<string>();
  private subscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.subscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.isOwnersDataReceived = false;
        return this.ownerService.searchOwners(q).pipe(
          finalize(() => this.isOwnersDataReceived = true)
        );
      })
    ).subscribe(
      owners => this.owners = owners,
      error => this.errorMessage = error as any
    );

    // Load all owners on init
    this.searchSubject.next('');
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onQueryChange(value: string) {
    this.searchSubject.next(value);
  }

  clearSearch() {
    this.query = '';
    this.searchSubject.next('');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
