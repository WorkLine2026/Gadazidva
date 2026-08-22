import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllListingsComponent } from './all-listings-component';

describe('AllListingsComponent', () => {
  let component: AllListingsComponent;
  let fixture: ComponentFixture<AllListingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllListingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AllListingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
