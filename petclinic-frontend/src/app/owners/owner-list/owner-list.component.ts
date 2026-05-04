import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  errorMessage: string;
  owners: Owner[];
  isOwnersDataReceived: boolean = false;

  readonly searchControl = new FormControl('');
  private subscription: Subscription;
  private updatingUrl = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ownerService: OwnerService
  ) {}

  ngOnInit() {
    const initialQ = (this.route.snapshot.queryParams['q'] ?? '').trim();
    if (initialQ) {
      this.searchControl.setValue(initialQ, { emitEvent: false });
    }

    this.subscription = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      skip(0)
    ).subscribe(q => this.runSearch(q ?? ''));

    this.runSearch(initialQ);

    this.route.queryParamMap.pipe(skip(1)).subscribe(params => {
      if (this.updatingUrl) {
        return;
      }
      const q = (params.get('q') ?? '').trim();
      this.searchControl.setValue(q, { emitEvent: false });
      this.runSearch(q);
    });
  }

  private runSearch(q: string) {
    const trimmed = q.trim();
    this.updatingUrl = true;
    this.router.navigate(['/owners'], {
      queryParams: { q: trimmed || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    }).finally(() => { this.updatingUrl = false; });

    const search$ = trimmed
      ? this.ownerService.searchOwners(trimmed)
      : this.ownerService.getOwners();

    search$.subscribe(
      owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error => this.errorMessage = error as any
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
