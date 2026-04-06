import {Component, OnDestroy, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {merge, of, Subject} from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  query: string;
  owners: Owner[];
  isOwnersDataReceived: boolean = false;
  private searchTerms = new Subject<string>();
  private blurTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    merge(
      of(''),
      this.searchTerms.pipe(debounceTime(500)),
      this.blurTerms
    ).pipe(
      map((term) => term ? term.trim() : ''),
      distinctUntilChanged(),
      switchMap((term) => this.findOwners(term)
        .pipe(finalize(() => this.isOwnersDataReceived = true))),
      takeUntil(this.destroy$)
    ).subscribe(
      owners => {
        this.owners = owners;
        this.errorMessage = null;
      },
      error => this.errorMessage = error as any);
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  getPetNames(owner: Owner): string {
    return owner.pets.map((pet) => pet.name).join(', ');
  }

  onSearchTermChange(query: string) {
    this.searchTerms.next(query);
  }

  onSearchBlur(query: string) {
    this.blurTerms.next(query);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
    this.blurTerms.complete();
  }

  private findOwners(query: string) {
    return query === '' ? this.ownerService.getOwners() : this.ownerService.searchOwners(query);
  }


}
