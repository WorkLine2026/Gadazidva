import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser, AdminUserDetails } from '../../services/Admin.service';
import { statusMeta, ROLE_LABELS } from '../admin-labels';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-component.html',
  styleUrls: ['../admin-shared.scss']
})
export class AdminUsersComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  users: AdminUser[] = [];
  searchTerm = '';
  roleFilter = 'all';
  page = 1;
  pages = 1;
  total = 0;
  readonly limit = 20;

  selected: AdminUserDetails | null = null;
  detailsLoading = false;

  meta = statusMeta;
  roleLabels = ROLE_LABELS;
  private searchTimer: any;

  constructor(private admin: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.admin.getUsers({ page: this.page, limit: this.limit, search: this.searchTerm.trim(), role: this.roleFilter }).subscribe({
      next: (res) => {
        this.users = res.data || [];
        this.total = res.total;
        this.pages = res.pages;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ მომხმარებლების შეცდომა:', err);
        this.errorMessage = err?.error?.message || 'მომხმარებლების ჩატვირთვა ვერ მოხერხდა';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page = 1; this.load(); }, 350);
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.load();
  }

  openDetails(user: AdminUser): void {
    this.detailsLoading = true;
    this.selected = null;
    this.cdr.markForCheck();
    this.admin.getUserDetails(user._id).subscribe({
      next: (res) => {
        this.selected = res;
        this.detailsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.detailsLoading = false;
        alert('❌ დეტალების ჩატვირთვა ვერ მოხერხდა');
        this.cdr.markForCheck();
      }
    });
  }

  closeDetails(): void {
    this.selected = null;
    this.detailsLoading = false;
  }

  changeRole(user: AdminUser, role: string): void {
    if (role === user.role) return;
    if (!confirm(`შევცვალო როლი → ${this.roleLabels[role]}?`)) {
      this.load();
      return;
    }
    this.admin.setUserRole(user._id, role).subscribe({
      next: (res) => {
        if (res.success) user.role = role as any;
        else alert('❌ ' + (res.message || 'ვერ შეიცვალა'));
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert('❌ ' + (err?.error?.message || 'ვერ შეიცვალა'));
        this.load();
      }
    });
  }

  toggleBan(user: AdminUser): void {
    const ban = !user.isBanned;
    let reason = '';

    if (ban) {
      const input = prompt('დაბლოკვის მიზეზი (არასავალდებულო):');
      if (input === null) return; // Cancel
      reason = input.trim();
    } else if (!confirm('განვბლოკო ეს მომხმარებელი?')) {
      return;
    }

    this.admin.setUserBanned(user._id, ban, reason).subscribe({
      next: (res) => {
        if (res.success) {
          user.isBanned = ban;
          user.bannedReason = ban ? reason : '';
        } else alert('❌ ' + (res.message || 'ვერ შესრულდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'ვერ შესრულდა'))
    });
  }

  deleteUser(user: AdminUser): void {
    if (!confirm(`⚠️ წავშალო ${user.firstName} ${user.lastName} და მისი ყველა განცხადება, მგზავრობა და შეთავაზება? ეს ქმედება შეუქცევადია.`)) return;
    this.admin.deleteUser(user._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.users = this.users.filter((u) => u._id !== user._id);
          this.total--;
        } else alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'წაშლა ვერ მოხერხდა'))
    });
  }
}