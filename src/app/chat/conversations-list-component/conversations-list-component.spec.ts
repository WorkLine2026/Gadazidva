import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConversationsListComponent } from './conversations-list-component';

describe('ConversationsListComponent', () => {
  let component: ConversationsListComponent;
  let fixture: ComponentFixture<ConversationsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationsListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
