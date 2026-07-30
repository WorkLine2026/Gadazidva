import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastNotificationsComponent } from './toast-notifications-component';

describe('ToastNotificationsComponent', () => {
  let component: ToastNotificationsComponent;
  let fixture: ComponentFixture<ToastNotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastNotificationsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastNotificationsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
