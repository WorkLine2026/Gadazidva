import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService, ParcelRequest } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';

type SendStep = 'details' | 'confirmation' | 'success';

interface StepData {
  parcelDetails?: ParcelRequest;
  requestId?: string;
}

@Component({
  selector: 'app-send-parcel',
  templateUrl: './send-parcel-component.html',
  styleUrls: ['./send-parcel-component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [ParcelService] // ✅ დაამატე providers
})
export class SendParcelComponent implements OnInit {
  currentStep: SendStep = 'details';
  
  detailsForm!: FormGroup;
  stepData: StepData = {};

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
    private parcelService: ParcelService,  // ✅ დაამატე ტიპი
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.smsService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.initDetailsForm();
  }

  private initDetailsForm(): void {
    this.detailsForm = this.fb.group({
      from: ['', [Validators.required]],
      to: ['', [Validators.required]],
      shipDate: ['', [Validators.required]],
      description: ['', [Validators.required]],
      weight: ['', [Validators.required, Validators.min(0.1)]],
      value: ['', [Validators.required, Validators.min(1)]],
      notes: [''],
      senderPhone: ['', [Validators.required]],
      recipientPhone: ['', [Validators.required]]
    });
  }

  // ============ STEP 1: SUBMIT DETAILS ============

  submitDetails(): void {
    if (this.detailsForm.invalid) {
      this.markFormAsTouched();
      this.errorMessage = 'გთხოვთ, შეავსოთ ყველა აუცილებელი ველი';
      return;
    }

    this.errorMessage = null;
    this.successMessage = null;

    const parcelDetails: ParcelRequest = this.detailsForm.getRawValue();
    
    // ✅ ვალიდაციის შემოწმება
    if (!this.parcelService.isValidRoute(parcelDetails.from, parcelDetails.to)) {
      this.errorMessage = 'მარშრუტი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidWeight(parcelDetails.weight)) {
      this.errorMessage = 'წონა უნდა იყოს 0.1 - 300 კგ';
      return;
    }

    if (!this.parcelService.isValidValue(parcelDetails.value)) {
      this.errorMessage = 'ღირებულება უნდა იყოს 1 - 1,000,000 ₾';
      return;
    }

    if (!this.parcelService.isValidPhone(parcelDetails.senderPhone)) {
      this.errorMessage = 'თქვენი ტელეფონი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidPhone(parcelDetails.recipientPhone)) {
      this.errorMessage = 'მიმღების ტელეფონი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidShipDate(parcelDetails.shipDate)) {
      this.errorMessage = 'თარიღი უნდა იყოს დღეს ან მის შემდეგ';
      return;
    }

    this.stepData.parcelDetails = parcelDetails;

    // გადი დადასტურების ნაბიჯზე
    this.currentStep = 'confirmation';
    this.cdr.detectChanges();
  }

  private markFormAsTouched(): void {
    Object.values(this.detailsForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.detailsForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // ============ STEP 2: SUBMIT REQUEST ============

  submitRequest(): void {
    if (!this.stepData.parcelDetails) {
      this.errorMessage = 'ინფორმაცია დაკარგულია. გთხოვთ თავიდან დაიწყეთ';
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    // ✅ გამოიძახე service რომ დადოს განცხადება
    this.parcelService.createParcelRequest(this.stepData.parcelDetails).subscribe({
      next: (res) => {
        this.isSaving = false;

        if (res.success) {
          this.stepData.requestId = res.requestId;
          this.successMessage = 'განცხადება წარმატებით დაიქვიათ!';
          this.currentStep = 'success';
        } else {
          this.errorMessage = res.message || 'განცხადება ვერ დამატდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err.error?.message || 'შეცდომა: განცხადება ვერ დამატდა. გთხოვთ, სცადეთ ხელახლა';
        console.error('Error creating parcel request:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ============ UTILITIES ============

  goBack(): void {
    if (this.currentStep === 'details') {
      this.router.navigate(['/profile']);
    } else if (this.currentStep === 'confirmation') {
      this.currentStep = 'details';
      this.errorMessage = null;
    }
    this.cdr.detectChanges();
  }

  finishAndReturn(): void {
    this.router.navigate(['/profile']);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '—';
    return this.parcelService.formatDate(dateString);
  }

  getFormattedPrice(price?: number): string {
    if (!price) return '—';
    return this.parcelService.formatPrice(price);
  }
}