import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ParcelService, ParcelRequest, DriverTrip } from '../../services/Parcel.service';

interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  totalTrips: number;
  activeTrips: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard-component.html',
  styleUrls: ['./admin-dashboard-component.scss']
})
export class AdminDashboardComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  stats: DashboardStats = {
    totalRequests: 0,
    pendingRequests: 0,
    totalTrips: 0,
    activeTrips: 0
  };

  recentRequests: ParcelRequest[] = [];
  recentTrips: DriverTrip[] = [];

  // ⚠️ getRecentRequests()/getRecentTrips() ლიმიტირებული "ბოლო" ჩანაწერების
  // სიაა backend-ზე, არა ყველა ჩანაწერი — ამიტომ ეს რიცხვები ახლა
  // მხოლოდ დემონსტრაციულია. ნამდვილი "სულ რაოდენობისთვის" backend-ს
  // დასჭირდება ცალკე /admin/stats ან /admin/all-requests endpoint.
  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🟢 AdminDashboard ngOnInit გაეშვა');
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    console.log('🟢 loadDashboardData გაეშვა, request იგზავნება...');
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    forkJoin({
      requests: this.parcelService.getRecentRequests(),
      trips: this.parcelService.getRecentTrips()
    }).subscribe({
      next: ({ requests, trips }) => {
        this.recentRequests = requests.requests || [];
        this.recentTrips = trips.trips || [];

        this.stats.totalRequests = this.recentRequests.length;
        this.stats.pendingRequests = this.recentRequests.filter(r => r.status === 'pending').length;
        this.stats.totalTrips = this.recentTrips.length;
        this.stats.activeTrips = this.recentTrips.filter(t => t.status === 'active').length;

        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ dashboard მონაცემების ჩატვირთვის შეცდომა:', err);
        this.errorMessage = 'მონაცემების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }
}