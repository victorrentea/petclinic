import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OwnerPage } from './owner-page';
import { OwnerService } from './owner.service';

export interface PageRequest {
  page: number;
  size: number;
  sort: string[];
  q: string;
}

@Injectable()
export class OwnerPaginationService {
  private cache = new Map<string, OwnerPage>();
  private generation = 0;

  private loadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.loadingSubject.asObservable();

  private pageSubject = new BehaviorSubject<OwnerPage | null>(null);
  currentPage$ = this.pageSubject.asObservable();

  constructor(private ownerService: OwnerService) {}

  private cacheKey(req: PageRequest): string {
    return JSON.stringify({ page: req.page, size: req.size, sort: req.sort, q: req.q });
  }

  loadPage(req: PageRequest): void {
    const key = this.cacheKey(req);
    if (this.cache.has(key)) {
      this.pageSubject.next(this.cache.get(key)!);
      this.prefetch(req);
      return;
    }
    const gen = this.generation;
    this.loadingSubject.next(true);
    this.ownerService.getOwners(req).subscribe(result => {
      if (this.generation !== gen) { return; }
      this.cache.set(key, result);
      this.pageSubject.next(result);
      this.loadingSubject.next(false);
      this.prefetch(req);
    });
  }

  private prefetch(req: PageRequest): void {
    if ((navigator as any).connection?.saveData) { return; }
    const current = this.pageSubject.value;
    if (!current) { return; }
    const gen = this.generation;

    const tryFetch = (page: number) => {
      const prefetchReq: PageRequest = { ...req, page };
      const key = this.cacheKey(prefetchReq);
      if (this.cache.has(key)) { return; }
      this.ownerService.getOwners(prefetchReq).subscribe(result => {
        if (this.generation !== gen) { return; }
        this.cache.set(key, result);
      });
    };

    if (req.page + 1 < current.totalPages) { tryFetch(req.page + 1); }
    if (req.page - 1 >= 0) { tryFetch(req.page - 1); }

    this.evictDistant(req.page);
  }

  clearCache(): void {
    this.cache.clear();
    this.generation++;
    this.loadingSubject.next(false);
  }

  private evictDistant(currentPage: number): void {
    for (const key of Array.from(this.cache.keys())) {
      try {
        const parsed = JSON.parse(key);
        if (Math.abs(parsed.page - currentPage) > 1) {
          this.cache.delete(key);
        }
      } catch { /* ignore malformed keys */ }
    }
  }
}
