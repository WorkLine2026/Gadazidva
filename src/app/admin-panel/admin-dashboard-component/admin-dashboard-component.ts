import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminStats } from '../../services/Admin.service';
import { statusMeta, ROLE_LABELS } from '../admin-labels';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard-component.html',
  styleUrls: ['../admin-shared.scss']
})
export class AdminDashboardComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  stats: AdminStats | null = null;

  meta = statusMeta;
  roles = ROLE_LABELS;

  constructor(private admin: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.admin.getStats().subscribe({
      next: (res) => {
        this.stats = res.stats;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ stats შეცდომა:', err);
        this.errorMessage = err?.error?.message || 'სტატისტიკის ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }
}