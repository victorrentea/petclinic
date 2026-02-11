import {Component, OnInit} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, finalize} from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  name: string;
  owners: Owner[];
  private readonly searchTerms = new Subject<string>();
  isOwnersDataReceived: boolean = false;

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.ownerService.getOwners().pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      owners => this.owners = owners,
      error => this.errorMessage = error as any);

    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((term) => this.executeSearch(term));
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  queueSearch(rawTerm: string) {
    const normalized = this.normalizeSearchTerm(rawTerm);
    this.searchTerms.next(normalized);
  }

  searchOnBlur() {
    this.executeSearch(this.normalizeSearchTerm(this.name || ''));
  }

  searchOnEnter() {
    this.executeSearch(this.normalizeSearchTerm(this.name || ''));
  }

  private executeSearch(term: string) {
    this.ownerService.getOwners(term)
      .subscribe(
        (owners) => {
          this.owners = owners;
        },
        () => {
          this.owners = null;
        }
      );
  }

  private normalizeSearchTerm(rawTerm: string): string {
    return rawTerm.trim().split(' ').filter(Boolean).join(' ');
  }


}
