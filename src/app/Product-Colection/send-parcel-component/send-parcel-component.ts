import { Component, OnInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService, ParcelRequest } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { Location } from '@angular/common';

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
  providers: [ParcelService]
})
export class SendParcelComponent implements OnInit {
  currentStep: SendStep = 'details';

  detailsForm!: FormGroup;
  stepData: StepData = {};

  isLoading: boolean = false;
  isSaving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // ✅ ავტოკომპლიტისთვის — გახსნილია თუ არა dropdown და გაფილტრული სია თითოეული ველისთვის
  showFromDropdown = false;
  showToDropdown = false;
  filteredFromCities: string[] = [];
  filteredToCities: string[] = [];

  // ✅ ფოტოს ატვირთვისთვის
  maxImages = 3;
  maxFileSizeBytes = 1 * 1024 * 1024; // 1MB თითო ფოტოზე (კომპრესიის შემდეგ)
  maxOriginalFileSizeBytes = 30 * 1024 * 1024; // 30MB — ამაზე დიდს არც ვცდით დამუშავებას
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  imageError: string | null = null;
  isProcessingImages = false; // ✅ compression მიმდინარეობის indicator

  // ✅ getter-ის მეშვეობით (constructor-მდე initialize არ საჭიროა)
  get GEORGIAN_CITIES(): string[] {
    return this.parcelService.GEORGIAN_CITIES_AND_TOWNS;
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
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

  // ================== "საიდან" ავტოკომპლიტი ==================

  onFromInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.detailsForm.get('from')!.setValue(value);
    this.filteredFromCities = this.filterCities(value);
    this.showFromDropdown = true;
  }

  onFromFocus(): void {
    const value = this.detailsForm.get('from')!.value || '';
    this.filteredFromCities = this.filterCities(value);
    this.showFromDropdown = true;
  }

  selectFromCity(city: string): void {
    this.detailsForm.get('from')!.setValue(city);
    this.showFromDropdown = false;
  }

  // ================== "სად" ავტოკომპლიტი ==================

  onToInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.detailsForm.get('to')!.setValue(value);
    this.filteredToCities = this.filterCities(value);
    this.showToDropdown = true;
  }

  onToFocus(): void {
    const value = this.detailsForm.get('to')!.value || '';
    this.filteredToCities = this.filterCities(value);
    this.showToDropdown = true;
  }

  selectToCity(city: string): void {
    this.detailsForm.get('to')!.setValue(city);
    this.showToDropdown = false;
  }

  // ✅ ფილტრავს ქალაქების სიას შეყვანილი ტექსტის მიხედვით (case-insensitive)
  private filterCities(query: string): string[] {
    const cities = this.GEORGIAN_CITIES || [];
    if (!query || !query.trim()) {
      return cities;
    }
    const normalizedQuery = query.trim().toLowerCase();
    return cities.filter(city => city.toLowerCase().includes(normalizedQuery));
  }

  // ✅ დავხუროთ dropdown-ები, თუ მომხმარებელმა გარეთ დააჭირა
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showFromDropdown = false;
      this.showToDropdown = false;
    }
  }

  // ============ ფოტოს ატვირთვა + კომპრესია ============

  async onImagesSelected(event: Event): Promise<void> {
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

    this.isProcessingImages = true;
    this.cdr.detectChanges();

    for (const file of filesToProcess) {
      // ✅ ტიპის შემოწმება
      if (!file.type.startsWith('image/')) {
        this.imageError = 'დასაშვებია მხოლოდ სურათის ფაილები';
        continue;
      }

      // ✅ ძალიან დიდ ფაილებს არც ვცდილობთ დამუშავებას
      if (file.size > this.maxOriginalFileSizeBytes) {
        this.imageError = 'ფოტოს საწყისი ზომა ძალიან დიდია (მაქს. 30MB)';
        continue;
      }

      try {
        const compressedFile = await this.compressImage(file, this.maxFileSizeBytes);
        this.selectedImages.push(compressedFile);

        const previewUrl = await this.readFileAsDataUrl(compressedFile);
        this.imagePreviews.push(previewUrl);
      } catch (err) {
        this.imageError = 'ფოტოს დამუშავება ვერ მოხერხდა';
      }
    }

    this.isProcessingImages = false;
    this.cdr.detectChanges();

    // ✅ input-ის გასუფთავება, რომ იმავე ფაილის ხელახლა არჩევა შესაძლებელი იყოს
    input.value = '';
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    this.imageError = null;
    this.cdr.detectChanges();
  }

  // ✅ სურათს ამცირებს resize + quality-ის ეტაპობრივი შემცირებით, სანამ maxSizeBytes-ს არ ჩაეტევა
  private async compressImage(file: File, maxSizeBytes: number): Promise<File> {
    if (file.size <= maxSizeBytes) {
      return file;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await this.loadImage(dataUrl);

    let width = img.width;
    let height = img.height;
    const maxDimension = 1600;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context ვერ შეიქმნა');
    }

    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.8;
    let blob = await this.canvasToBlob(canvas, quality);

    while (blob.size > maxSizeBytes && quality > 0.1) {
      quality -= 0.1;
      blob = await this.canvasToBlob(canvas, quality);
    }

    // ✅ თუ quality-ის დაწევითაც ვერ ჩავეტიეთ ზომაში — დამატებით ვამცირებთ განზომილებას
    if (blob.size > maxSizeBytes) {
      const scaleFactor = Math.sqrt(maxSizeBytes / blob.size);
      canvas.width = Math.max(1, Math.round(width * scaleFactor));
      canvas.height = Math.max(1, Math.round(height * scaleFactor));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await this.canvasToBlob(canvas, 0.7);
    }

    return new File(
      [blob],
      file.name.replace(/\.\w+$/, '.jpg'),
      { type: 'image/jpeg' }
    );
  }

  private readFileAsDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('ფაილის წაკითხვა ვერ მოხერხდა'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('სურათის ჩატვირთვა ვერ მოხერხდა'));
      img.src = dataUrl;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('კომპრესია ვერ შესრულდა'))),
        'image/jpeg',
        quality
      );
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

    const formValue = this.detailsForm.getRawValue();

    // ✅ ვალიდაციის შემოწმება
    if (!this.parcelService.isValidRoute(formValue.from, formValue.to)) {
      this.errorMessage = 'მარშრუტი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidWeight(formValue.weight)) {
      this.errorMessage = 'წონა უნდა იყოს 0.1 - 300 კგ';
      return;
    }

    if (!this.parcelService.isValidValue(formValue.value)) {
      this.errorMessage = 'ღირებულება უნდა იყოს 1 - 1,000,000 ₾';
      return;
    }

    if (!this.parcelService.isValidPhone(formValue.senderPhone)) {
      this.errorMessage = 'თქვენი ტელეფონი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidPhone(formValue.recipientPhone)) {
      this.errorMessage = 'მიმღების ტელეფონი ვალიდი არ არის';
      return;
    }

    if (!this.parcelService.isValidShipDate(formValue.shipDate)) {
      this.errorMessage = 'თარიღი უნდა იყოს დღეს ან მის შემდეგ';
      return;
    }

    // ✅ დადეთ როგორც ParcelRequest
    const parcelDetails: ParcelRequest = {
      from: formValue.from,
      to: formValue.to,
      shipDate: formValue.shipDate,
      description: formValue.description,
      weight: formValue.weight,
      value: formValue.value,
      senderPhone: formValue.senderPhone,
      recipientPhone: formValue.recipientPhone,
      notes: formValue.notes || undefined
    };

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

    // ✅ თუ ფოტოები ატვირთულია, ვაგზავნით FormData-ს, თუ არა — ჩვეულებრივ JSON-ს
    const payload = this.selectedImages.length > 0
      ? this.buildFormData(this.stepData.parcelDetails, this.selectedImages)
      : this.stepData.parcelDetails;

    this.parcelService.createParcelRequest(payload).subscribe({
      next: (res) => {
        this.isSaving = false;

        if (res.success) {
          // ✅ requestId-ის მიღება სწორი გზით
          this.stepData.requestId = res.requestId || res.data?._id || 'უცნობი';
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

  // ✅ ქმნის FormData-ს ტექსტური ველებით + ფოტოებით ('images' ველის სახელით)
  private buildFormData(details: ParcelRequest, images: File[]): FormData {
    const formData = new FormData();

    Object.entries(details).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    images.forEach((file) => {
      formData.append('images', file, file.name);
    });

    return formData;
  }

  // ============ UTILITIES ============

  goBack(): void {
    if (this.currentStep === 'details') {
      window.history.back();
    } else if (this.currentStep === 'confirmation') {
      this.currentStep = 'details';
      this.errorMessage = null;
    }

    this.cdr.detectChanges();
  }

  // ✅ განახლებული: finishAndReturn() - state-ით ProfileComponent-ზე
  finishAndReturn(): void {
    // გამგზავნის განცხადების მონაცემების გადაწერა ProfileComponent-ზე state-ით
    if (this.stepData.parcelDetails && this.stepData.requestId) {
      this.router.navigate(['/profile'], {
        state: {
          newRequest: {
            from: this.stepData.parcelDetails.from,
            to: this.stepData.parcelDetails.to,
            description: this.stepData.parcelDetails.description,
            weight: this.stepData.parcelDetails.weight,
            value: this.stepData.parcelDetails.value,
            shipDate: this.stepData.parcelDetails.shipDate,
            senderPhone: this.stepData.parcelDetails.senderPhone,
            recipientPhone: this.stepData.parcelDetails.recipientPhone,
            notes: this.stepData.parcelDetails.notes
          },
          requestId: this.stepData.requestId,
          isNewRequest: true
        }
      });
    } else {
      // თუ რაიმე მიზეზით requestId არ არის, უბრალოდ დაბრუნდი
      this.router.navigate(['/profile']);
    }
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