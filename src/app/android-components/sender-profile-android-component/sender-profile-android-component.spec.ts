import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SenderProfileAndroidComponent } from './sender-profile-android-component';

describe('SenderProfileAndroidComponent', () => {
  let component: SenderProfileAndroidComponent;
  let fixture: ComponentFixture<SenderProfileAndroidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SenderProfileAndroidComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SenderProfileAndroidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
