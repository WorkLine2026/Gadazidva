import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AndroidLoginComponent } from './android-login-component';

describe('AndroidLoginComponent', () => {
  let component: AndroidLoginComponent;
  let fixture: ComponentFixture<AndroidLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AndroidLoginComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AndroidLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
