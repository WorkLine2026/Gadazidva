import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Howtowork } from './howtowork';

describe('Howtowork', () => {
  let component: Howtowork;
  let fixture: ComponentFixture<Howtowork>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Howtowork],
    }).compileComponents();

    fixture = TestBed.createComponent(Howtowork);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
