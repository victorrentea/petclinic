import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  lastName: string;
  owners: Owner[];
  listOfOwnersWithLastName: Owner[];
  isOwnersDataReceived: boolean = false;
  private load: Subscription;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.load = this.ownerService.getOwners().pipe(
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

  // Only the latest query may answer: a search sent while the initial load is still in
  // flight would otherwise be overwritten by the full list when it lands afterwards.
  searchByLastName(lastName: string) {
    this.load?.unsubscribe();
    const owners$ = lastName ? this.ownerService.searchOwners(lastName) : this.ownerService.getOwners();
    this.load = owners$.subscribe(
      owners => this.owners = owners,
      () => this.owners = null);
  }
}
