import {Component, OnInit} from '@angular/core';
import {Vet} from '../vet';
import {VetService} from '../vet.service';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ReviewService } from '../review.service';
import { ReviewStats } from '../review.model';
import { forkJoin } from 'rxjs';

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
  reviewStatsMap: Map<number, ReviewStats> = new Map();
  activeReviewFormVetId: number | null = null;

  constructor(
    private vetService: VetService, 
    private router: Router,
    private reviewService: ReviewService
  ) {
    this.vets = [];
  }

  ngOnInit() {
    this.vetService.getVets().pipe(
      finalize(() => {
        this.isVetDataReceived = true;
      })
    ).subscribe(
      vets => {
        this.vets = vets;
        this.loadReviewStats();
      },
      error => this.errorMessage = error as any);
  }

  loadReviewStats() {
    if (this.vets.length === 0) {
      return;
    }

    // Load all review stats in a single bulk request
    this.reviewService.getAllReviewStats().subscribe(
      statsMap => {
        // Populate the map with stats from the bulk response
        this.vets.forEach(vet => {
          if (statsMap[vet.id]) {
            this.reviewStatsMap.set(vet.id, statsMap[vet.id]);
          } else {
            // Create empty stats for vets with no reviews
            const emptyStats: ReviewStats = {
              vetId: vet.id,
              averageRating: 0,
              totalReviews: 0
            };
            this.reviewStatsMap.set(vet.id, emptyStats);
          }
        });
      },
      error => {
        // On error, create empty stats for all vets
        this.vets.forEach(vet => {
          const emptyStats: ReviewStats = {
            vetId: vet.id,
            averageRating: 0,
            totalReviews: 0
          };
          this.reviewStatsMap.set(vet.id, emptyStats);
        });
      }
    );
  }

  getReviewStats(vetId: number): ReviewStats | undefined {
    return this.reviewStatsMap.get(vetId);
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

  showReviewForm(vetId: number) {
    this.activeReviewFormVetId = vetId;
  }

  hideReviewForm() {
    this.activeReviewFormVetId = null;
  }

  isReviewFormVisible(vetId: number): boolean {
    return this.activeReviewFormVetId === vetId;
  }

  onReviewSubmitted(vetId: number) {
    // Refresh review stats for this vet
    this.reviewService.getReviewStats(vetId).subscribe(
      stats => {
        this.reviewStatsMap.set(stats.vetId, stats);
        this.hideReviewForm();
      },
      error => {
        console.error('Error refreshing review stats:', error);
        this.hideReviewForm();
      }
    );
  }
}
