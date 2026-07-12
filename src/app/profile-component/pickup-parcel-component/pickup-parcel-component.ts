import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';

type PickupStep = 'trip-plan' | 'success';

@Component({
  selector: 'app-pickup-parcel',
  templateUrl: './pickup-parcel-component.html',
  styleUrls: ['./pickup-parcel-component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [ParcelService]
})
export class PickupParcelComponent implements OnInit {
  currentStep: PickupStep = 'trip-plan';
  tripForm!: FormGroup;
  createdTrip: DriverTrip | null = null;

  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  readonly GEORGIAN_CITIES = [
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'გორი', 'დუშეთი',
    'ზუგდიდი', 'სოხუმი', 'თელავი', 'გორიცხე', 'ხელვაჩაური',
    'სარპი', 'პოტი', 'მცხეთა', 'სიღნაღი', 'ხაშური'
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.smsService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.initTripForm();
  }

  private initTripForm(): void {
    this.tripForm = this.fb.group({
      from: ['', [Validators.required]],
      to: ['', [Validators.required]],
      departureDate: ['', [Validators.required]],
      departureTime: ['', [Validators.required]],
      availableSpace: ['', [Validators.required, Validators.min(1)]],
      pricePerKg: ['', [Validators.required, Validators.min(0.1)]],
      personalNumber: ['', [Validators.required, Validators.minLength(11), Validators.maxLength(11)]],
      senderPhone: ['', [Validators.required]],
      carModel: [''],
      carPlate: [''],
      comments: ['']
    });
  }

  submitTrip(): void {
    if (this.tripForm.invalid) {
      this.markFormAsTouched();
      this.errorMessage = 'გთხოვთ, შეავსოთ ყველა აუცილებელი ველი';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    const tripData: DriverTrip = {
      from: this.tripForm.get('from')!.value,
      to: this.tripForm.get('to')!.value,
      departureDate: this.combineDateAndTime(
        this.tripForm.get('departureDate')!.value,
        this.tripForm.get('departureTime')!.value
      ),
      availableSpace: Number(this.tripForm.get('availableSpace')!.value),
      pricePerKg: Number(this.tripForm.get('pricePerKg')!.value),
      personalNumber: this.tripForm.get('personalNumber')!.value,
      senderPhone: this.tripForm.get('senderPhone')!.value,
      carModel: this.tripForm.get('carModel')!.value || undefined,
      carPlate: this.tripForm.get('carPlate')!.value || undefined,
      comments: this.tripForm.get('comments')!.value || undefined,
      _id: '',
      driverId: ''
    };

    this.parcelService.createTrip(tripData).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res.success) {
          this.createdTrip = tripData;
          this.currentStep = 'success';
          this.successMessage = 'მგზავრობის განცხადება წარმატებით დაემატა! 🎉';

          // ✅ ყველა listener-ს აცნობით (პროფილის კომპონენტი მოუსმენს)
          this.parcelService.notifyTripCreated(tripData);
        } else {
          this.errorMessage = res.message || 'მგზავრობა ვერ განათავსდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'შეცდომა: მგზავრობა ვერ განათავსდა';
        this.cdr.detectChanges();
      }
    });
  }

  private combineDateAndTime(date: string, time: string): string {
    return `${date}T${time}`;
  }

  private markFormAsTouched(): void {
    Object.values(this.tripForm.controls).forEach(control => control.markAsTouched());
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.tripForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  formatDateTime(dateString?: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE') + ' ' + date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  }

  goBack(): void {
    if (this.currentStep === 'trip-plan') {
      this.router.navigate(['/profile']);
    } else if (this.currentStep === 'success') {
      this.currentStep = 'trip-plan';
    }
    this.cdr.detectChanges();
  }

  returnToProfile(): void {
    this.router.navigate(['/profile']);
  }
}