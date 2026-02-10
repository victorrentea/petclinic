import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';

@Component({
  selector: 'app-owner-add',
  templateUrl: './owner-add.component.html',
  styleUrls: ['./owner-add.component.css']
})
export class OwnerAddComponent implements OnInit {

  owner: Owner;
  errorMessage: string;

  constructor(private ownerService: OwnerService, private router: Router) {
    this.owner = {} as Owner;
  }

  ngOnInit() {
  }

  onSubmit(owner: Owner) {
    owner.id = null;
    this.ownerService.addOwner(owner).subscribe(
      newOwner => {
        this.owner = newOwner;
        this.gotoOwnersList();
      },
      error => this.errorMessage = error as any
    );
  }

  gotoOwnersList() {
    this.router.navigate(['/owners']);
  }

}
