import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { environment } from '../../environment/environment';

// იგივე გასაღები, რასაც ინტერცეპტორი და guard კითხულობს
const TOKEN_KEY = 'authToken';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login-component.html',
  styleUrls: ['./admin-login-component.scss']
})
export class AdminLoginComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  show = false;
  loading = false;
  error = '';

  submit() {
    if (this.loading) return;
    this.loading = true;
    this.error = '';

    this.http
      .post<any>(`${environment.apiUrl}/admin/login`, { email: this.email.trim(), password: this.password })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (r) => {
          localStorage.setItem(TOKEN_KEY, r.token);
          this.router.navigateByUrl('/admin');
        },
        error: (e) => {
          this.error = e?.error?.message || 'შესვლა ვერ მოხერხდა';
          this.cdr.detectChanges();
        }
      });
  }
}