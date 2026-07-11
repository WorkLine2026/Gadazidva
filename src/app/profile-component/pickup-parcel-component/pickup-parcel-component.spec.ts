import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PickupParcelComponent } from './pickup-parcel-component';

describe('PickupParcelComponent', () => {
  let component: PickupParcelComponent;
  let fixture: ComponentFixture<PickupParcelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PickupParcelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PickupParcelComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
