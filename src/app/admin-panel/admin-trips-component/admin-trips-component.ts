import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';

type StatusFilter = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

@Component({
  selector: 'app-admin-trips',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-trips-component.html',
  styleUrls: ['./admin-trips-component.scss']
})
export class AdminTripsComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  allTrips: DriverTrip[] = [];
  filteredTrips: DriverTrip[] = [];

  statusFilter: StatusFilter = 'all';
  searchTerm = '';

  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    // ⚠️ დროებით getRecentTrips()-ს ვიყენებთ (public, ლიმიტირებული).
    // TODO: შეცვალეთ admin-specific endpoint-ით, როცა backend-ზე დაემატება.
    this.parcelService.getRecentTrips().subscribe({
      next: (res) => {
        this.allTrips = res.trips || [];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ მგზავრობების ჩატვირთვის შეცდომა:', err);
        this.errorMessage = 'მგზავრობების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    let result = [...this.allTrips];

    if (this.statusFilter !== 'all') {
      result = result.filter(t => t.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(t =>
        t.from?.toLowerCase().includes(term) ||
        t.to?.toLowerCase().includes(term) ||
        t.driverName?.toLowerCase().includes(term) ||
        t.carPlate?.toLowerCase().includes(term)
      );
    }

    this.filteredTrips = result;
  }

  onStatusFilterChange(): void {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  cancelTrip(tripId: string | undefined): void {
    if (!tripId) return;

    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ მგზავრობის გაუქმება?')) {
      return;
    }

    // ⚠️ ownership-based — მუშაობს მხოლოდ თუ ადმინი ამ trip-ის driver-ია.
    // admin override საჭიროებს backend-ის მხარდაჭერას.
    this.parcelService.cancelTrip(tripId).subscribe({
      next: (res) => {
        if (res.success) {
          const trip = this.allTrips.find(t => t._id === tripId);
          if (trip) trip.status = 'cancelled';
          this.applyFilters();
        } else {
          alert('❌ ' + (res.message || 'გაუქმება ვერ მოხერხდა'));
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ გაუქმების შეცდომა:', err);
        alert('❌ გაუქმება ვერ მოხერხდა — შესაძლოა admin-ს არ აქვს ამის უფლება backend-ზე');
        this.cdr.markForCheck();
      }
    });
  }

  getStatusLabel(status: string | undefined): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ დაგეგმილი',
      'active': '🚗 აქტიური',
      'completed': '✅ დასრულებული',
      'cancelled': '❌ გაუქმებული'
    };
    return labels[status || 'pending'] || status || '⏳ დაგეგმილი';
  }

  getStatusColor(status: string | undefined): string {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'active': '#10b981',
      'completed': '#3b82f6',
      'cancelled': '#ef4444'
    };
    return colors[status || ''] || '#6b7280';
  }
}