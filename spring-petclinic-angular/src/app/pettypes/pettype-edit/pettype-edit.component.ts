import {Component, OnInit} from '@angular/core';
import {PetType} from '../pettype';
import {PetTypeService} from '../pettype.service';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-pettype-edit',
  templateUrl: './pettype-edit.component.html',
  styleUrls: ['./pettype-edit.component.css']
})
export class PettypeEditComponent implements OnInit {
  pettype: PetType;
  errorMessage: string;

  constructor(private pettypeService: PetTypeService, private route: ActivatedRoute, private router: Router) {
    this.pettype = {} as PetType;
  }

  ngOnInit() {
    const pettypeId = this.route.snapshot.params.id;
    this.pettypeService.getPetTypeById(pettypeId).subscribe(
      pettype => this.pettype = pettype,
      error => this.errorMessage = error as any);
  }

  onSubmit(pettype: PetType) {
    this.pettypeService.updatePetType(pettype.id.toString(), pettype).subscribe(
      res => {
        console.log('update success');
        this.onBack();
      },
      error => this.errorMessage = error as any);

  }

  onBack() {
    this.router.navigate(['/pettypes']);
  }

}
