import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPullToRefresh]',
  standalone: true
})
export class PullToRefreshDirective {
  @Input() threshold = 80; // რამდენი px უნდა ჩამოვწიოთ რომ refresh გამოიწვიოს
  @Output() refresh = new EventEmitter<() => void>();

  private startY = 0;
  private currentY = 0;
  private pulling = false;
  private refreshing = false;
  private indicator: HTMLElement | null = null;

  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {
    this.createIndicator();
  }

  private createIndicator() {
    this.indicator = this.renderer.createElement('div');
    this.renderer.setStyle(this.indicator, 'position', 'absolute');
    this.renderer.setStyle(this.indicator, 'top', '-50px');
    this.renderer.setStyle(this.indicator, 'left', '0');
    this.renderer.setStyle(this.indicator, 'right', '0');
    this.renderer.setStyle(this.indicator, 'display', 'flex');
    this.renderer.setStyle(this.indicator, 'justify-content', 'center');
    this.renderer.setStyle(this.indicator, 'align-items', 'center');
    this.renderer.setStyle(this.indicator, 'height', '50px');
    this.renderer.setStyle(this.indicator, 'transition', 'transform 0.2s ease');
    this.renderer.setProperty(this.indicator, 'innerHTML',
      `<div class="ptr-spinner" style="width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;"></div>`);

    const hostStyle = this.el.nativeElement.style;
    if (getComputedStyle(this.el.nativeElement).position === 'static') {
      this.renderer.setStyle(this.el.nativeElement, 'position', 'relative');
    }
    this.renderer.appendChild(this.el.nativeElement, this.indicator);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    // მუშაობს მხოლოდ თუ სქროლი თავშია (წინააღმდეგ შემთხვევაში ჩვეულებრივი სქროლის დაბლოკვას გამოიწვევდა)
    if (this.el.nativeElement.scrollTop === 0 && !this.refreshing) {
      this.startY = e.touches[0].clientY;
      this.pulling = true;
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(e: TouchEvent) {
    if (!this.pulling || this.refreshing) return;

    this.currentY = e.touches[0].clientY;
    const diff = this.currentY - this.startY;

    if (diff > 0 && this.el.nativeElement.scrollTop === 0) {
      // ხელით ჩამოწევის ვიზუალური ეფექტი (resistance-ით, რომ ძალიან ადვილად არ იჭიმებოდეს)
      const pull = Math.min(diff * 0.5, this.threshold * 1.5);
      this.renderer.setStyle(this.el.nativeElement, 'transform', `translateY(${pull}px)`);

      if (this.indicator) {
        const rotation = (pull / this.threshold) * 360;
        const spinner = this.indicator.querySelector('.ptr-spinner') as HTMLElement;
        if (spinner) spinner.style.transform = `rotate(${rotation}deg)`;
      }

      // scroll-ის ჩვეულებრივი ქცევის თავიდან აცილება pull-ის დროს
      if (diff > 10) e.preventDefault();
    }
  }

  @HostListener('touchend')
  onTouchEnd() {
    if (!this.pulling || this.refreshing) return;
    this.pulling = false;

    const diff = this.currentY - this.startY;
    if (diff * 0.5 >= this.threshold) {
      this.triggerRefresh();
    } else {
      this.resetPosition();
    }
  }

  private triggerRefresh() {
    this.refreshing = true;
    this.renderer.setStyle(this.el.nativeElement, 'transform', `translateY(${this.threshold}px)`);

    // ვაძლევთ callback-ს, რომელსაც parent component გამოიძახებს refresh დასრულებისას
    this.refresh.emit(() => {
      this.refreshing = false;
      this.resetPosition();
    });
  }

  private resetPosition() {
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'translateY(0)');
    this.startY = 0;
    this.currentY = 0;
  }
}