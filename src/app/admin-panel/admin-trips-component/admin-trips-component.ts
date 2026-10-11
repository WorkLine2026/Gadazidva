import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/Admin.service';
import { DriverTrip } from '../../services/Parcel.service';
import { statusMeta, TRIP_STATUSES } from '../admin-labels';

@Component({
  selector: 'app-admin-trips',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-trips-component.html',
  styleUrls: ['../admin-shared.scss']
})
export class AdminTripsComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  trips: DriverTrip[] = [];
  statusFilter = 'all';
  searchTerm = '';
  page = 1;
  pages = 1;
  total = 0;
  readonly limit = 20;

  selected: DriverTrip | null = null;

  meta = statusMeta;
  statuses = TRIP_STATUSES;
  private searchTimer: any;

  constructor(private admin: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.admin.getTrips({ page: this.page, limit: this.limit, search: this.searchTerm.trim(), status: this.statusFilter }).subscribe({
      next: (res) => {
        this.trips = res.data || [];
        this.total = res.total;
        this.pages = res.pages;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ მგზავრობების შეცდომა:', err);
        this.errorMessage = err?.error?.message || 'მგზავრობების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.loadTrips(); }, 350);
  }

  onStatusFilterChange(): void {
    this.page = 1;
    this.loadTrips();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.loadTrips();
  }

  changeStatus(trip: DriverTrip, status: string): void {
    if (status === trip.status) return;
    this.admin.setTripStatus(trip._id, status).subscribe({
      next: (res) => {
        if (res.success) trip.status = status as any;
        else alert('❌ ' + (res.message || 'ვერ შეიცვალა'));
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert('❌ ' + (err?.error?.message || 'ვერ შეიცვალა'));
        this.loadTrips();
      }
    });
  }

  deleteTrip(trip: DriverTrip): void {
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ მგზავრობის წაშლა?')) return;

    this.admin.deleteTrip(trip._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.trips = this.trips.filter((t) => t._id !== trip._id);
          this.total--;
          if (this.selected?._id === trip._id) this.selected = null;
        } else alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'წაშლა ვერ მოხერხდა'))
    });
  }
}