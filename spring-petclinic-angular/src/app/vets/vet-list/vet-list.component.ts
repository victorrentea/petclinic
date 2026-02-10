import {Component, OnInit} from '@angular/core';
import {Vet} from '../vet';
import {VetService} from '../vet.service';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-vet-list',
  templateUrl: './vet-list.component.html',
  styleUrls: ['./vet-list.component.css']
})
export class VetListComponent implements OnInit {
  vets: Vet[];
  errorMessage: string;
  responseStatus: number;
  isVetDataReceived: boolean = false;

  constructor(private vetService: VetService, private router: Router) {
    this.vets = [];
  }

  ngOnInit() {
    this.vetService.getVets().pipe(
      finalize(() => {
        this.isVetDataReceived = true;
      })
    ).subscribe(
      vets => this.vets = vets,
      error => this.errorMessage = error as any);
  }

  deleteVet(vet: Vet) {
    this.vetService.deleteVet(vet.id.toString()).subscribe(
      response => {
        this.responseStatus = response;
        this.vets = this.vets.filter(currentItem => !(currentItem.id === vet.id));
      },
      error => this.errorMessage = error as any);
  }

  gotoHome() {
    this.router.navigate(['/welcome']);
  }

  addVet() {
    this.router.navigate(['/vets/add']);
  }

  editVet(vet: Vet) {
    this.router.navigate(['/vets', vet.id, 'edit']);
  }
}
