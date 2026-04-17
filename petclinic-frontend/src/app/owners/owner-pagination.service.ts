import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OwnerService } from './owner.service';
import { OwnerPage } from './owner-page';

const ROW_HEIGHT_PX = 41;
const MIN_PAGE_SIZE = 5;

@Injectable()
export class OwnerPaginationService {
  private cache = new Map<string, OwnerPage>();
  private generation = 0;
  currentPage$ = new BehaviorSubject<OwnerPage | null>(null);

  constructor(private ownerService: OwnerService) {}

  loadPage(page: number, size: number, sort: string[], q: string): void {
    const key = this.cacheKey(page, size, sort, q);
    const cached = this.cache.get(key);
    if (cached) {
      this.currentPage$.next(cached);
      this.prefetchAdjacent(page, size, sort, q, cached.totalPages);
      return;
    }
    this.ownerService.getOwners(page, size, sort, q).subscribe({
      next: ownerPage => {
        this.cache.set(key, ownerPage);
        this.currentPage$.next(ownerPage);
        this.evictDistantPages(page);
        this.prefetchAdjacent(page, size, sort, q, ownerPage.totalPages);
      }
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.generation++;
  }

  evictDistantPages(currentPage: number): void {
    for (const key of Array.from(this.cache.keys())) {
      const pageNum = this.pageFromKey(key);
      if (pageNum !== null && Math.abs(pageNum - currentPage) > 1) {
        this.cache.delete(key);
      }
    }
  }

  calculatePageSize(): number {
    const availableHeight = window.innerHeight - 300;
    const calculated = Math.floor(availableHeight / ROW_HEIGHT_PX);
    return Math.max(calculated, MIN_PAGE_SIZE);
  }

  private prefetchAdjacent(page: number, size: number, sort: string[], q: string, totalPages: number): void {
    if ((navigator as any).connection?.saveData) { return; }
    const genAtStart = this.generation;
    [-1, 1].forEach(delta => {
      const adjacent = page + delta;
      if (adjacent < 0 || adjacent >= totalPages) { return; }
      const key = this.cacheKey(adjacent, size, sort, q);
      if (this.cache.has(key)) { return; }
      this.ownerService.getOwners(adjacent, size, sort, q).subscribe({
        next: ownerPage => {
          if (this.generation !== genAtStart) { return; }
          this.cache.set(key, ownerPage);
        }
      });
    });
  }

  private cacheKey(page: number, size: number, sort: string[], q: string): string {
    return `${page}-${size}-${sort.join(',')}-${q}`;
  }

  private pageFromKey(key: string): number | null {
    const page = parseInt(key.split('-')[0], 10);
    return isNaN(page) ? null : page;
  }
}
