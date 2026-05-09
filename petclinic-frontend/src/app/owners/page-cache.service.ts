import { Injectable } from '@angular/core';
import { OwnerPage } from './owner-page';

@Injectable()
export class PageCacheService {
  private static readonly MAX_ENTRIES = 5;
  private cache = new Map<string, OwnerPage>();

  getPage(page: number, size: number, sort: string, q?: string): OwnerPage | null {
    const key = this.getCacheKey(page, size, sort, q);
    return this.cache.get(key) ?? null;
  }

  storePage(page: number, size: number, sort: string, q: string | undefined, data: OwnerPage): void {
    const key = this.getCacheKey(page, size, sort, q);
    if (this.cache.size >= PageCacheService.MAX_ENTRIES && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, data);
  }

  evictOutsideWindow(currentPage: number): void {
    const minPage = currentPage - 2;
    const maxPage = currentPage + 2;
    for (const key of Array.from(this.cache.keys())) {
      const pageNum = parseInt(key.split(':')[0], 10);
      if (pageNum < minPage || pageNum > maxPage) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getCacheKey(page: number, size: number, sort: string, q?: string): string {
    return `${page}:${size}:${sort}:${q ?? ''}`;
  }
}
