import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string = '';
  searchText: string = '';
  owners: Owner[] = [];
  isOwnersDataReceived: boolean = false;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.ownerService.getOwners().pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      owners => {
        this.owners = owners;
      },
      error => this.errorMessage = error as any);
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

    this.ownerService.searchOwners(searchText)
      .subscribe(
        owners => this.owners = owners,
        error => this.errorMessage = error as any
      );
  }


}
