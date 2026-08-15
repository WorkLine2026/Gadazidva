import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTripsComponent } from './admin-trips-component';

describe('AdminTripsComponent', () => {
  let component: AdminTripsComponent;
  let fixture: ComponentFixture<AdminTripsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTripsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTripsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
