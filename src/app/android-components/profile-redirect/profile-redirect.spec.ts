import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileRedirect } from './profile-redirect';

describe('ProfileRedirect', () => {
  let component: ProfileRedirect;
  let fixture: ComponentFixture<ProfileRedirect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileRedirect],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileRedirect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
