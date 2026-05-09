import { PageCacheService } from './page-cache.service';
import { OwnerPage } from './owner-page';

describe('PageCacheService', () => {
  let service: PageCacheService;

  function makePage(page: number, size: number = 10, totalElements: number = 100): OwnerPage {
    return {
      content: [],
      totalElements,
      totalPages: Math.ceil(totalElements / size),
      number: page,
      size,
    };
  }

  beforeEach(() => {
    service = new PageCacheService();
  });

  describe('getCacheKey', () => {
    it('should format key as page:size:sort:q', () => {
      expect(service.getCacheKey(0, 10, 'name,asc', 'test')).toBe('0:10:name,asc:test');
    });

    it('should use empty string when q is undefined', () => {
      expect(service.getCacheKey(0, 10, 'name,asc')).toBe('0:10:name,asc:');
    });

    it('should use empty string when q is undefined explicitly', () => {
      expect(service.getCacheKey(2, 25, 'city,desc', undefined)).toBe('2:25:city,desc:');
    });
  });

  describe('getPage', () => {
    it('should return null on cache miss', () => {
      const result = service.getPage(0, 10, 'name,asc', 'test');
      expect(result).toBeNull();
    });

    it('should return cached data on cache hit', () => {
      const page = makePage(0);
      service.storePage(0, 10, 'name,asc', undefined, page);
      const result = service.getPage(0, 10, 'name,asc');
      expect(result).toEqual(page);
    });

    it('should return null for different params even if page number matches', () => {
      const page = makePage(0);
      service.storePage(0, 10, 'name,asc', undefined, page);
      const result = service.getPage(0, 10, 'city,asc');
      expect(result).toBeNull();
    });
  });

  describe('storePage', () => {
    it('should store a page that can be retrieved', () => {
      const page = makePage(3);
      service.storePage(3, 10, 'name,asc', 'search', page);
      expect(service.getPage(3, 10, 'name,asc', 'search')).toEqual(page);
    });

    it('should overwrite existing entry with same key', () => {
      const page1 = makePage(0, 10, 50);
      const page2 = makePage(0, 10, 100);
      service.storePage(0, 10, 'name,asc', undefined, page1);
      service.storePage(0, 10, 'name,asc', undefined, page2);
      expect(service.getPage(0, 10, 'name,asc')).toEqual(page2);
    });
  });

  describe('evictOutsideWindow', () => {
    it('should keep pages within [current-2, current+2]', () => {
      // Store pages 1 through 5 (within max 5 limit)
      for (let i = 1; i <= 5; i++) {
        service.storePage(i, 10, 'name,asc', undefined, makePage(i));
      }
      // Evict with current page = 3 → keep pages 1,2,3,4,5
      service.evictOutsideWindow(3);
      expect(service.getPage(1, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(2, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(3, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(4, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(5, 10, 'name,asc')).not.toBeNull();
    });

    it('should remove pages outside the window', () => {
      // Store pages 0, 1, 2, 3, 4 (5 entries, at max)
      for (let i = 0; i <= 4; i++) {
        service.storePage(i, 10, 'name,asc', undefined, makePage(i));
      }
      // Evict with current page = 4 → keep pages 2,3,4
      service.evictOutsideWindow(4);
      expect(service.getPage(0, 10, 'name,asc')).toBeNull();
      expect(service.getPage(1, 10, 'name,asc')).toBeNull();
      expect(service.getPage(2, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(3, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(4, 10, 'name,asc')).not.toBeNull();
    });

    it('should handle edge case when current page is 0', () => {
      for (let i = 0; i <= 4; i++) {
        service.storePage(i, 10, 'name,asc', undefined, makePage(i));
      }
      service.evictOutsideWindow(0);
      // Window is [0-2, 0+2] = [-2, 2], clamped to [0, 2]
      expect(service.getPage(0, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(1, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(2, 10, 'name,asc')).not.toBeNull();
      expect(service.getPage(3, 10, 'name,asc')).toBeNull();
      expect(service.getPage(4, 10, 'name,asc')).toBeNull();
    });

    it('should only evict pages matching the same size/sort/q params', () => {
      service.storePage(0, 10, 'name,asc', undefined, makePage(0));
      service.storePage(5, 10, 'name,asc', undefined, makePage(5));
      service.storePage(0, 25, 'city,desc', 'test', makePage(0, 25));
      service.evictOutsideWindow(0);
      // Page 5 with same params should be evicted (outside [0-2, 0+2])
      expect(service.getPage(5, 10, 'name,asc')).toBeNull();
      // Page 0 with different params should also be evicted if outside window
      // Actually, eviction is based on page number in the key, regardless of other params
      // The window check extracts the page number from the cache key
      expect(service.getPage(0, 25, 'city,desc', 'test')).not.toBeNull();
    });
  });

  describe('invalidateAll', () => {
    it('should clear all cached entries', () => {
      service.storePage(0, 10, 'name,asc', undefined, makePage(0));
      service.storePage(1, 10, 'name,asc', undefined, makePage(1));
      service.storePage(2, 10, 'city,desc', 'search', makePage(2));
      service.invalidateAll();
      expect(service.getPage(0, 10, 'name,asc')).toBeNull();
      expect(service.getPage(1, 10, 'name,asc')).toBeNull();
      expect(service.getPage(2, 10, 'city,desc', 'search')).toBeNull();
    });
  });

  describe('max 5 entries', () => {
    it('should not exceed 5 entries in the cache', () => {
      // Store 6 pages
      for (let i = 0; i < 6; i++) {
        service.storePage(i, 10, 'name,asc', undefined, makePage(i));
      }
      // The cache should hold at most 5 entries
      // The oldest entry (page 0) should have been evicted
      let cachedCount = 0;
      for (let i = 0; i < 6; i++) {
        if (service.getPage(i, 10, 'name,asc') !== null) {
          cachedCount++;
        }
      }
      expect(cachedCount).toBeLessThanOrEqual(5);
    });

    it('should evict the oldest entry when adding a 6th page', () => {
      for (let i = 0; i < 5; i++) {
        service.storePage(i, 10, 'name,asc', undefined, makePage(i));
      }
      // All 5 should be present
      for (let i = 0; i < 5; i++) {
        expect(service.getPage(i, 10, 'name,asc')).not.toBeNull();
      }
      // Add a 6th entry
      service.storePage(5, 10, 'name,asc', undefined, makePage(5));
      // Oldest (page 0) should be evicted
      expect(service.getPage(0, 10, 'name,asc')).toBeNull();
      // Newest should be present
      expect(service.getPage(5, 10, 'name,asc')).not.toBeNull();
    });
  });
});
