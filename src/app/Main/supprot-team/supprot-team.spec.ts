import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupprotTeam } from './supprot-team';

describe('SupprotTeam', () => {
  let component: SupprotTeam;
  let fixture: ComponentFixture<SupprotTeam>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupprotTeam],
    }).compileComponents();

    fixture = TestBed.createComponent(SupprotTeam);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
