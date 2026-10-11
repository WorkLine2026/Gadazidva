import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/Admin.service';
import { ParcelRequest } from '../../services/Parcel.service';
import { statusMeta, REQUEST_STATUSES } from '../admin-labels';

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-requests-component.html',
  styleUrls: ['../admin-shared.scss']
})
export class AdminRequestsComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  requests: ParcelRequest[] = [];
  statusFilter = 'all';
  searchTerm = '';
  page = 1;
  pages = 1;
  total = 0;
  readonly limit = 20;

  selected: ParcelRequest | null = null;

  meta = statusMeta;
  statuses = REQUEST_STATUSES;
  private searchTimer: any;

  constructor(private admin: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.admin.getRequests({ page: this.page, limit: this.limit, search: this.searchTerm.trim(), status: this.statusFilter }).subscribe({
      next: (res) => {
        this.requests = res.data || [];
        this.total = res.total;
        this.pages = res.pages;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ განცხადებების შეცდომა:', err);
        this.errorMessage = err?.error?.message || 'განცხადებების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.loadRequests(); }, 350);
  }

  onStatusFilterChange(): void {
    this.page = 1;
    this.loadRequests();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.loadRequests();
  }

  changeStatus(req: ParcelRequest, status: string): void {
    if (!req._id || status === req.status) return;
    this.admin.setRequestStatus(req._id, status).subscribe({
      next: (res) => {
        if (res.success) req.status = status as any;
        else alert('❌ ' + (res.message || 'ვერ შეიცვალა'));
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert('❌ ' + (err?.error?.message || 'ვერ შეიცვალა'));
        this.loadRequests();
      }
    });
  }

  deleteRequest(req: ParcelRequest): void {
    if (!req._id) return;
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ განცხადების წაშლა?')) return;

    this.admin.deleteRequest(req._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.requests = this.requests.filter((r) => r._id !== req._id);
          this.total--;
          if (this.selected?._id === req._id) this.selected = null;
        } else alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'წაშლა ვერ მოხერხდა'))
    });
  }
}