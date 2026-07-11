import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Registercomponent } from './registercomponent';

describe('Registercomponent', () => {
  let component: Registercomponent;
  let fixture: ComponentFixture<Registercomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registercomponent],
    }).compileComponents();

    fixture = TestBed.createComponent(Registercomponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
