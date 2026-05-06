import { Component, OnDestroy, OnInit } from '@angular/core';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip, switchMap } from 'rxjs/operators';

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
  private searchSubject = new Subject<string>();
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

    this.subscription = this.searchSubject.pipe(
      switchMap(q => q ? this.ownerService.searchOwners(q) : this.ownerService.getOwners())
    ).subscribe(
      owners => {
        this.owners = owners;
        this.isOwnersDataReceived = true;
      },
      error => this.errorMessage = error as any
    );

    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
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

    this.searchSubject.next(trimmed);
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.searchSubject.complete();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
