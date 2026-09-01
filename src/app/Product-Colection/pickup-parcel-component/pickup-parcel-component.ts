import { Component, OnInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { Location } from '@angular/common';

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

  // ✅ ავტოკომპლიტისთვის — გახსნილია თუ არა dropdown და გაფილტრული სია თითოეული ველისთვის
  showFromDropdown = false;
  showToDropdown = false;
  filteredFromCities: string[] = [];
  filteredToCities: string[] = [];

  // ✅ მანქანის ფოტოს ატვირთვისთვის
  maxImages = 3;
  maxFileSizeBytes = 5 * 1024 * 1024; // 5MB თითო ფოტოზე
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  imageError: string | null = null;

  readonly GEORGIAN_CITIES_AND_TOWNS = [
    // 1. მსხვილი ქალაქები და რეგიონული ცენტრები
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი',
    'ზუგდიდი', 'ფოთი', 'ხაშური', 'სამტრედია', 'სენაკი',
    'ზესტაფონი', 'თელავი', 'ახალციხე', 'ქობულეთი', 'ოზურგეთი',

    // 2. შიდა ქართლი & ქვემო ქართლი
    'კასპი', 'მარნეული', 'გარდაბანი', 'ბოლნისი', 'დმანისი',
    'წალკა', 'თეთრიწყარო', 'ქარელი', 'სურამი', 'აგარა',
    'მცხეთა', 'თიანეთი', 'ჟინვალი', 'ფასანაური',

    // 3. იმერეთი & რაჭა-ლეჩხუმი-ქვემო სვანეთი
    'ტყიბული', 'წყალტუბო', 'ჭიათურა', 'საჩხერე', 'ხონი',
    'ბაღდათი', 'ვანი', 'თერჯოლა', 'ამბროლაური', 'ონი',
    'ცაგერი', 'ლენტეხი', 'კულაში',

    // 4. სამეგრელო-ზემო სვანეთი
    'ჯვარი', 'აბაშა', 'მარტვილი', 'წალენჯიხა', 'მესტია',
    'ჩხოროწყუ', 'ანაკლია',

    // 5. კახეთი
    'საგარეჯო', 'გურჯაანი', 'ყვარელი', 'სიღნაღი',
    'დედოფლისწყარო', 'ლაგოდეხი', 'ახმეტა',

    // 6. სამცხე-ჯავახეთი
    'ახალქალაქი', 'ნინოწმინდა', 'ბორჯომი', 'ვალე',
    'აბასთუმანი', 'ბაკურიანი', 'ადიგენი', 'ასპინძა',

    // 7. გურია & აჭარა
    'ლანჩხუთი', 'ჩოხატაური', 'ურეკი', 'ქედა',
    'შუახევი', 'ხულო', 'ჩაქვი', 'ხელვაჩაური',

    // 8. მცხეთა-მთიანეთი
    'დუშეთი', 'სტეფანწმინდა',

    // 9. აფხაზეთი & ცხინვალის რეგიონი
    'სოხუმი', 'გაგრა', 'გუდაუთა', 'ოჩამჩირე', 'გალი',
    'ტყვარჩელი', 'ახალი ათონი', 'ცხინვალი', 'ჯავა',
    'ქურთას დასახლება', 'ახალგორი', 'ბიჭვინთა', 'gulripshi'
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private location: Location
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

  // ================== "საიდან" ავტოკომპლიტი ==================

  onFromInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tripForm.get('from')!.setValue(value);
    this.filteredFromCities = this.filterCities(value);
    this.showFromDropdown = true;
  }

  onFromFocus(): void {
    const value = this.tripForm.get('from')!.value || '';
    this.filteredFromCities = this.filterCities(value);
    this.showFromDropdown = true;
  }

  selectFromCity(city: string): void {
    this.tripForm.get('from')!.setValue(city);
    this.showFromDropdown = false;
  }

  // ================== "სად" ავტოკომპლიტი ==================

  onToInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tripForm.get('to')!.setValue(value);
    this.filteredToCities = this.filterCities(value);
    this.showToDropdown = true;
  }

  onToFocus(): void {
    const value = this.tripForm.get('to')!.value || '';
    this.filteredToCities = this.filterCities(value);
    this.showToDropdown = true;
  }

  selectToCity(city: string): void {
    this.tripForm.get('to')!.setValue(city);
    this.showToDropdown = false;
  }

  // ✅ ფილტრავს ქალაქების სიას შეყვანილი ტექსტის მიხედვით (case-insensitive)
  private filterCities(query: string): string[] {
    if (!query || !query.trim()) {
      return this.GEORGIAN_CITIES_AND_TOWNS;
    }
    const normalizedQuery = query.trim().toLowerCase();
    return this.GEORGIAN_CITIES_AND_TOWNS.filter(city =>
      city.toLowerCase().includes(normalizedQuery)
    );
  }

  // ✅ დავხუროთ dropdown-ები, თუ მომხმარებელმა გარეთ დააჭირა
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showFromDropdown = false;
      this.showToDropdown = false;
    }
  }

  // ============ მანქანის ფოტოს ატვირთვა ============

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.imageError = null;

    if (!files || files.length === 0) {
      return;
    }

    const remainingSlots = this.maxImages - this.selectedImages.length;

    if (remainingSlots <= 0) {
      this.imageError = `მაქსიმუმ ${this.maxImages} ფოტოს ატვირთვა შეგიძლიათ`;
      input.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      this.imageError = `მაქსიმუმ ${this.maxImages} ფოტოს ატვირთვა შეგიძლიათ`;
    }

    for (const file of filesToProcess) {
      // ✅ ტიპის შემოწმება
      if (!file.type.startsWith('image/')) {
        this.imageError = 'დასაშვებია მხოლოდ სურათის ფაილები';
        continue;
      }

      // ✅ ზომის შემოწმება
      if (file.size > this.maxFileSizeBytes) {
        this.imageError = 'ფოტოს ზომა არ უნდა აღემატებოდეს 5MB-ს';
        continue;
      }

      this.selectedImages.push(file);

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreviews.push(reader.result as string);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }

    // ✅ input-ის გასუფთავება, რომ იმავე ფაილის ხელახლა არჩევა შესაძლებელი იყოს
    input.value = '';
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    this.imageError = null;
    this.cdr.detectChanges();
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

    // ✅ თუ მანქანის ფოტოები ატვირთულია, ვაგზავნით FormData-ს, თუ არა — ჩვეულებრივ JSON-ს
    const payload = this.selectedImages.length > 0
      ? this.buildFormData(tripData, this.selectedImages)
      : tripData;

    this.parcelService.createTrip(payload).subscribe({
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

  // ✅ ქმნის FormData-ს ტექსტური ველებით + ფოტოებით ('images' ველის სახელით)
  private buildFormData(trip: DriverTrip, images: File[]): FormData {
    const formData = new FormData();

    Object.entries(trip).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value));
      }
    });

    images.forEach((file) => {
      formData.append('images', file, file.name);
    });

    return formData;
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
    this.location.back();
  } else if (this.currentStep === 'success') {
    this.currentStep = 'trip-plan';
  }

  this.cdr.detectChanges();
}

  returnToProfile(): void {
    this.router.navigate(['/profile']);
  }
}