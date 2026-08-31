import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatModalImprovedComponent } from './chat-modal-component';

describe('ChatModalImprovedComponent', () => {
  let component: ChatModalImprovedComponent;
  let fixture: ComponentFixture<ChatModalImprovedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatModalImprovedComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatModalImprovedComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});