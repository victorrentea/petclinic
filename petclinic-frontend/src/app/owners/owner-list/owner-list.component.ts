import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  lastName: string;
  owners: Owner[];
  listOfOwnersWithLastName: Owner[];
  isOwnersDataReceived: boolean = false;
  private readonly searchTerms = new Subject<string>();
  private searchSubscription: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe((term) => this.searchByTerm(term));

    this.ownerService.getOwners().pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      owners => this.owners = owners,
      error => this.errorMessage = error as any);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchInput() {
    this.searchTerms.next(this.lastName || '');
  }

  onSearchBlur() {
    this.searchByTerm(this.lastName || '');
  }

  searchByTerm(lastName: string) {
    if (lastName === '') {
      this.ownerService.getOwners().subscribe((owners) => {
        this.owners = owners;
      });
      return;
    }

    this.ownerService.searchOwners(lastName).subscribe(
      (owners) => {
        this.owners = owners;
      },
      () => {
        this.owners = null;
      }
    );
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    this.searchTerms.complete();
  }

}
