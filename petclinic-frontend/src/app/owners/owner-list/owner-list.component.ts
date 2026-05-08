import {Component, OnInit, inject, DestroyRef} from '@angular/core';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap, finalize} from 'rxjs/operators';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit {
  errorMessage: string;
  searchText: string = '';
  owners: Owner[] = [];
  isLoading: boolean = false;
  isOwnersDataReceived: boolean = false;

  private searchSubject = new Subject<string>();
  private destroyRef = inject(DestroyRef);

  constructor(private router: Router, private ownerService: OwnerService) {

  }

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(term => {
        this.isLoading = true;
        return this.ownerService.getOwners(term || undefined).pipe(
          finalize(() => {
            this.isLoading = false;
            this.isOwnersDataReceived = true;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: owners => {
        this.owners = owners;
      },
      error: () => {
        this.owners = [];
      }
    });

    // Load all owners on init
    this.searchSubject.next('');
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }
}
