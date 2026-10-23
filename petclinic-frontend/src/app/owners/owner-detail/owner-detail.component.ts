import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Owner} from '../owner';
import {OwnerListState} from '../owner-list/owner-list-state';
import {toQueryParams} from '../owner-list/owner-list-url';


@Component({
  selector: 'app-owner-detail',
  templateUrl: './owner-detail.component.html',
  styleUrls: ['./owner-detail.component.css']
})
export class OwnerDetailComponent implements OnInit {
  errorMessage: string;
  owner: Owner;

  constructor(private route: ActivatedRoute, private router: Router, private ownerService: OwnerService,
              private ownerListState: OwnerListState) {
    this.owner = {} as Owner;
  }

  ngOnInit() {
    const ownerId = this.route.snapshot.params.id;
    this.ownerService.getOwnerById(ownerId).subscribe(
      owner => this.owner = owner,
      error => this.errorMessage = error as any);
  }

  gotoOwnersList() {
    const lastQuery = this.ownerListState.lastQuery;
    if (lastQuery) {
      this.router.navigate(['/owners'], {queryParams: toQueryParams(lastQuery)});
    } else {
      this.router.navigate(['/owners']);
    }
  }

  editOwner() {
    this.router.navigate(['/owners', this.owner.id, 'edit']);
  }

  addPet(owner: Owner) {
    this.router.navigate(['/owners', owner.id, 'pets', 'add']);
  }


}
