import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Location} from '@angular/common';
import {Owner} from '../owner';


@Component({
  selector: 'app-owner-detail',
  templateUrl: './owner-detail.component.html',
  styleUrls: ['./owner-detail.component.css']
})
export class OwnerDetailComponent implements OnInit {
  errorMessage: string;
  owner: Owner;

  constructor(private route: ActivatedRoute, private router: Router, private ownerService: OwnerService,
              private location: Location) {
    this.owner = {} as Owner;
  }

  ngOnInit() {
    const ownerId = this.route.snapshot.params.id;
    this.ownerService.getOwnerById(ownerId).subscribe(
      owner => this.owner = owner,
      error => this.errorMessage = error as any);
  }

  // back to the grid page the user came from; the first page when this page was opened directly
  gotoOwnersList() {
    const cameFromInsideTheApp = (this.location.getState() as {navigationId?: number})?.navigationId > 1;
    if (cameFromInsideTheApp) {
      this.location.back();
    } else {
      void this.router.navigate(['/owners']);
    }
  }

  editOwner() {
    this.router.navigate(['/owners', this.owner.id, 'edit']);
  }

  addPet(owner: Owner) {
    this.router.navigate(['/owners', owner.id, 'pets', 'add']);
  }


}
