import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pushnofication } from './pushnofication';

describe('Pushnofication', () => {
  let component: Pushnofication;
  let fixture: ComponentFixture<Pushnofication>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pushnofication],
    }).compileComponents();

    fixture = TestBed.createComponent(Pushnofication);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
