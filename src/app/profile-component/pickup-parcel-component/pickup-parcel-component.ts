import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService, DriverTrip, AvailableShipping } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';

type PickupStep = 'trip-plan' | 'available-shippings' | 'success';

interface PickupData {
  trip?: DriverTrip;
  tripId?: string;
  availableShippings?: AvailableShipping[];
  acceptedShippings?: AvailableShipping[];
}

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
  pickupData: PickupData = {
    availableShippings: [],
    acceptedShippings: []
  };

  isLoading: boolean = false;
  isSaving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  readonly GEORGIAN_CITIES = [
    'თბილისი',
    'ბათუმი',
    'ქუთაისი',
    'გორი',
    'დუშეთი',
    'ზუგდიდი',
    'სოხუმი',
    'თელავი',
    'გორიცხე',
    'ხელვაჩაური',
    'სარპი',
    'პოტი',
    'მცხეთა',
    'სიღნაგი',
    'ხაშური'
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
      carModel: [''],
      carPlate: [''],
      comments: ['']
    });
  }

  // ============ STEP 1: PLAN TRIP ============

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
      availableSpace: this.tripForm.get('availableSpace')!.value,
      pricePerKg: this.tripForm.get('pricePerKg')!.value,
      carModel: this.tripForm.get('carModel')!.value || undefined,
      carPlate: this.tripForm.get('carPlate')!.value || undefined,
      comments: this.tripForm.get('comments')!.value || undefined
    };

    this.parcelService.createTrip(tripData).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res.success) {
          this.pickupData.trip = tripData;
          this.pickupData.tripId = res.tripId;
          this.successMessage = 'მგზავრობა წარმატებით განათავსდა! 🎉';
          
          // ნაბიჯი 2-ზე გადა
          setTimeout(() => {
            this.currentStep = 'available-shippings';
            this.loadAvailableShippings();
          }, 1000);
        } else {
          this.errorMessage = res.message || 'მგზავრობა ვერ განათავსდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'შეცდომა: მგზავრობა ვერ განათავსდა';
        console.error('Error creating trip:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private combineDateAndTime(date: string, time: string): string {
    return `${date}T${time}`;
  }

  private markFormAsTouched(): void {
    Object.values(this.tripForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.tripForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // ============ STEP 2: AVAILABLE SHIPPINGS ============

  private loadAvailableShippings(): void {
    if (!this.pickupData.trip) return;

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();

    const { from, to, departureDate } = this.pickupData.trip;

    this.parcelService.getAvailableShippings(from, to, departureDate).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res.success) {
          this.pickupData.availableShippings = res.shippings || [];
          
          if (this.pickupData.availableShippings.length > 0) {
            this.successMessage = `${this.pickupData.availableShippings.length} ხელმისაწვდომი გაგზავნა იპოვნა! 📦`;
          } else {
            this.errorMessage = 'ამჯამად ამ მარშრუტზე გაგზავნა არ არის';
          }
        } else {
          this.errorMessage = res.message || 'გაგზავნების ჩაკრება ვერ მოხერხდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'შეცდომა: გაგზავნების ჩაკრება ვერ მოხერხდა';
        console.error('Error loading shippings:', err);
        this.cdr.detectChanges();
      }
    });
  }

  acceptShipping(shipping: AvailableShipping): void {
    if (!shipping._id) return;

    this.isSaving = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.parcelService.acceptShipping(shipping._id).subscribe({
      next: (res) => {
        this.isSaving = false;

        if (res.success) {
          // დაამატე accepted shipping-ების სიაში
          if (!this.pickupData.acceptedShippings) {
            this.pickupData.acceptedShippings = [];
          }
          this.pickupData.acceptedShippings.push(shipping);

          // აქვე shipping ხელმოშავი სიდან
          this.pickupData.availableShippings = (this.pickupData.availableShippings || []).filter(
            s => s._id !== shipping._id
          );

          this.successMessage = `✓ შეკვეთა მიღებულია!`;
          
          // ხელახლა დაცკეკი გაგზავნების თავისუფალი ადგილი
          if (this.pickupData.trip) {
            const totalWeight = this.pickupData.acceptedShippings.reduce(
              (sum, s) => sum + (s.parcelDetails?.weight || 0),
              0
            );
            this.pickupData.trip.availableSpace! -= (shipping.parcelDetails?.weight || 0);
          }
        } else {
          this.errorMessage = res.message || 'შეკვეთა ვერ მოხერხდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err.error?.message || 'შეცდომა: შეკვეთა ვერ მოხერხდა';
        console.error('Error accepting shipping:', err);
        this.cdr.detectChanges();
      }
    });
  }

  finishTrip(): void {
    this.currentStep = 'success';
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.detectChanges();
  }

  // ============ UTILITIES ============

  formatDate(dateString?: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE');
  }

  formatDateTime(dateString?: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('ka-GE') +
      ' ' +
      date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })
    );
  }

  getFormattedPrice(price?: number): string {
    if (!price) return '—';
    return `${price.toFixed(2)} ₾`;
  }

  getTripDepartureDate(): string {
    return this.formatDateTime(this.pickupData.trip?.departureDate);
  }

  getTripFromTo(): string {
    return `${this.pickupData.trip?.from || '—'} → ${this.pickupData.trip?.to || '—'}`;
  }

  getTripAvailableSpace(): string {
    return `${this.pickupData.trip?.availableSpace || '—'} კგ`;
  }

  getTripPrice(): string {
    return `${this.pickupData.trip?.pricePerKg || '—'} ₾/კგ`;
  }

  getShippingEarnings(shipping: AvailableShipping): string {
    const weight = shipping.parcelDetails?.weight || 0;
    const price = this.pickupData.trip?.pricePerKg || 0;
    return this.getFormattedPrice(weight * price);
  }

  getTotalEarnings(): string {
    const total = (this.pickupData.acceptedShippings || []).reduce((sum, shipping) => {
      const weight = shipping.parcelDetails?.weight || 0;
      const price = this.pickupData.trip?.pricePerKg || 0;
      return sum + weight * price;
    }, 0);
    return this.getFormattedPrice(total);
  }

  goBack(): void {
    if (this.currentStep === 'trip-plan') {
      this.router.navigate(['/profile']);
    } else if (this.currentStep === 'available-shippings') {
      this.currentStep = 'trip-plan';
    } else if (this.currentStep === 'success') {
      this.currentStep = 'available-shippings';
    }
    this.cdr.detectChanges();
  }

  returnToProfile(): void {
    this.router.navigate(['/profile']);
  }
}