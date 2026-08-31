import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DriverProfileAndroidComponent } from './driver-profile-android-component';

describe('DriverProfileAndroidComponent', () => {
  let component: DriverProfileAndroidComponent;
  let fixture: ComponentFixture<DriverProfileAndroidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverProfileAndroidComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DriverProfileAndroidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
