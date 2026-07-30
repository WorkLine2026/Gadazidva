import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatModalComponent } from './chat-modal-component';

describe('ChatModalComponent', () => {
  let component: ChatModalComponent;
  let fixture: ComponentFixture<ChatModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
