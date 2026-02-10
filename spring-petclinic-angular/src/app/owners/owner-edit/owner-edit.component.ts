import { Component, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-owner-edit',
  templateUrl: './owner-edit.component.html',
  styleUrls: ['./owner-edit.component.css'],
})
export class OwnerEditComponent implements OnInit {
  owner: Owner;
  errorMessage: string; // server error message
  ownerId: number;
  constructor(
    private ownerService: OwnerService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.owner = {} as Owner;
  }

  ngOnInit() {
    const ownerId = this.route.snapshot.params.id;
    this.ownerService.getOwnerById(ownerId).subscribe(
      (owner) => (this.owner = owner),
      (error) => (this.errorMessage = error as any)
    );
  }

  onSubmit(owner: Owner) {
    const that = this;  
    const ownerId = this.route.snapshot.params.id;
    this.ownerService.updateOwner(ownerId , owner).subscribe(
      (res) => this.gotoOwnerDetail(owner),
      (error) => (this.errorMessage = error as any)
    );
  }

  gotoOwnerDetail(owner: Owner) {
    this.errorMessage = null;
    this.router.navigate(['/owners', owner.id]);
  }
}
