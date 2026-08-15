import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ParcelService, ParcelRequest } from '../../services/Parcel.service';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'in-transit' | 'delivered';

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-requests-component.html',
  styleUrls: ['./admin-requests-component.scss']
})
export class AdminRequestsComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  allRequests: ParcelRequest[] = [];
  filteredRequests: ParcelRequest[] = [];

  statusFilter: StatusFilter = 'all';
  searchTerm = '';

  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    // ⚠️ დროებით getRecentRequests()-ს ვიყენებთ (public, ლიმიტირებული).
    // TODO: შეცვალეთ ეს admin-specific endpoint-ით (მაგ. /admin/all-requests),
    // როცა backend-ზე დაემატება — ეს component აღარაფერს საჭიროებს გარდა
    // ამ ერთი მეთოდის სახელის შეცვლისა.
    this.parcelService.getRecentRequests().subscribe({
      next: (res) => {
        this.allRequests = res.requests || [];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ განცხადებების ჩატვირთვის შეცდომა:', err);
        this.errorMessage = 'განცხადებების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    let result = [...this.allRequests];

    if (this.statusFilter !== 'all') {
      result = result.filter(r => r.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(r =>
        r.from?.toLowerCase().includes(term) ||
        r.to?.toLowerCase().includes(term) ||
        r.senderName?.toLowerCase().includes(term) ||
        r.senderPhone?.toLowerCase().includes(term)
      );
    }

    this.filteredRequests = result;
  }

  onStatusFilterChange(): void {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  deleteRequest(requestId: string | undefined): void {
    if (!requestId) return;

    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ განცხადების წაშლა?')) {
      return;
    }

    // ⚠️ ეს ახლა მუშაობს მხოლოდ თუ ადმინი ამავდროულად ამ განცხადების
    // ავტორია (ownership-based წაშლა backend-ზე). რეალურ admin override-ს
    // backend-ის მხრიდან ცალკე დაშვება დასჭირდება.
    this.parcelService.deleteParcelRequest(requestId).subscribe({
      next: (res) => {
        if (res.success) {
          this.allRequests = this.allRequests.filter(r => r._id !== requestId);
          this.applyFilters();
        } else {
          alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ წაშლის შეცდომა:', err);
        alert('❌ წაშლა ვერ მოხერხდა — შესაძლოა admin-ს არ აქვს ამის უფლება backend-ზე');
        this.cdr.markForCheck();
      }
    });
  }

  getStatusLabel(status: string | undefined): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ მოლოდინი',
      'accepted': '✅ მიღებული',
      'in-transit': '🚚 გზაში',
      'delivered': '📍 ჩაბარებული'
    };
    return labels[status || ''] || status || '—';
  }

  getStatusColor(status: string | undefined): string {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'accepted': '#10b981',
      'in-transit': '#3b82f6',
      'delivered': '#8b5cf6'
    };
    return colors[status || ''] || '#6b7280';
  }
}