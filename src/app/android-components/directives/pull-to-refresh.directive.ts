import { Directive, ElementRef, HostListener, Renderer2, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PullToRefreshService } from '../../services/PullToRefresh.Service';

@Directive({
  selector: '[appPullToRefresh]',
  standalone: true
})
export class PullToRefreshDirective implements OnInit, OnDestroy {
  private startY = 0;
  private currentY = 0;
  private isPulling = false;
  private isRefreshing = false;
  private isReady = false; // threshold გადალახულია - "გაუშვი რომ განახლდეს"

  private readonly threshold = 80; // px, რამდენი უნდა გაწიო რომ refresh ჩაირთოს
  private readonly maxPull = 120; // ვიზუალური ჭერი rubber-band ეფექტისთვის
  private readonly pinnedContentOffset = 14; // px, რამდენით რჩება კონტენტი "აწეული" refresh-ის დროს
  private readonly circumference = 2 * Math.PI * 15; // r=15 რგოლის გარშემოწერილობა

  private wrapperEl: HTMLElement | null = null;
  private ringProgressEl: SVGElement | null = null;
  private arrowEl: SVGElement | null = null;
  private subscription: Subscription | null = null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private pullToRefreshService: PullToRefreshService
  ) {}

  ngOnInit(): void {
    this.injectStylesOnce();
    this.createIndicator();
    this.subscription = this.pullToRefreshService.isRefreshing$.subscribe(state => {
      this.handleRefreshingStateChange(state);
    });
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (this.getScrollTop() === 0 && !this.isRefreshing) {
      this.startY = event.touches[0].clientY;
      this.isPulling = true;
      // drag-ის დროს transition გამორთულია, რომ თითს ზუსტად მიჰყვეს ანიმაცია
      this.setTransition(false);
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isPulling || this.isRefreshing) {
      return;
    }

    if (this.getScrollTop() > 0) {
      // მომხმარებელმა დაასქროლა - pull გავაუქმოთ, ჩვეულებრივ სქროლს ხელი არ შევუშალოთ
      this.isPulling = false;
      this.setTransition(true);
      this.snapBack();
      return;
    }

    this.currentY = event.touches[0].clientY;
    const rawDistance = this.currentY - this.startY;

    if (rawDistance <= 0) {
      this.updateVisual(0);
      return;
    }

    // rubber-band ფორმულა: რაც უფრო შორს სწევ, მით უფრო "იჯაბნება" pull - ბუნებრივი, ნაზი შეგრძნებაა
    const pull = this.maxPull * (1 - Math.exp(-rawDistance / (this.maxPull * 1.2)));
    this.updateVisual(pull);

    if (rawDistance > 10) {
      event.preventDefault();
    }
  }

  @HostListener('touchend')
  onTouchEnd(): void {
    if (!this.isPulling || this.isRefreshing) {
      this.isPulling = false;
      return;
    }

    this.isPulling = false;
    this.setTransition(true);

    if (this.isReady) {
      this.pinDuringRefresh();
      this.pullToRefreshService.triggerRefresh();
    } else {
      this.snapBack();
    }
  }

  // === ვიზუალის მართვა ===

  private updateVisual(pull: number): void {
    const progress = Math.min(pull / this.threshold, 1);
    this.isReady = progress >= 1;

    if (this.ringProgressEl) {
      const dashoffset = this.circumference * (1 - progress);
      this.renderer.setStyle(this.ringProgressEl, 'stroke-dashoffset', dashoffset.toString());
    }

    if (this.arrowEl) {
      const rotation = progress * 180;
      this.renderer.setStyle(this.arrowEl, 'transform', `rotate(${rotation}deg)`);
    }

    if (this.wrapperEl) {
      const scale = 0.7 + progress * 0.3;
      this.renderer.setStyle(this.wrapperEl, 'opacity', Math.min(progress * 1.6, 1).toString());
      this.renderer.setStyle(this.wrapperEl, 'transform', `translateX(-50%) scale(${scale})`);
      this.renderer.setStyle(this.wrapperEl, 'pointer-events', 'none');

      if (this.isReady) {
        this.renderer.addClass(this.wrapperEl, 'ptr-ready');
      } else {
        this.renderer.removeClass(this.wrapperEl, 'ptr-ready');
      }
    }

    this.renderer.setStyle(this.el.nativeElement, 'transform', `translateY(${pull}px)`);
  }

  private handleRefreshingStateChange(state: boolean): void {
    const wasRefreshing = this.isRefreshing;
    this.isRefreshing = state;

    if (state) {
      this.pinDuringRefresh();
    } else if (wasRefreshing) {
      if (this.wrapperEl) {
        this.renderer.removeClass(this.wrapperEl, 'ptr-spinning');
        this.renderer.removeClass(this.wrapperEl, 'ptr-ready');
      }
      this.setTransition(true);
      this.snapBack();
    }
  }

  private pinDuringRefresh(): void {
    this.setTransition(true);
    if (this.wrapperEl) {
      this.renderer.setStyle(this.wrapperEl, 'opacity', '1');
      this.renderer.setStyle(this.wrapperEl, 'transform', 'translateX(-50%) scale(1)');
      this.renderer.addClass(this.wrapperEl, 'ptr-spinning');
    }
    this.renderer.setStyle(this.el.nativeElement, 'transform', `translateY(${this.pinnedContentOffset}px)`);
  }

  private snapBack(): void {
    if (this.wrapperEl) {
      this.renderer.setStyle(this.wrapperEl, 'opacity', '0');
      this.renderer.setStyle(this.wrapperEl, 'transform', 'translateX(-50%) scale(0.7)');
    }
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'translateY(0px)');
    this.isReady = false;
  }

  private setTransition(enabled: boolean): void {
    const wrapperTransition = enabled
      ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out'
      : 'none';
    const contentTransition = enabled ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';

    if (this.wrapperEl) {
      this.renderer.setStyle(this.wrapperEl, 'transition', wrapperTransition);
    }
    this.renderer.setStyle(this.el.nativeElement, 'transition', contentTransition);
  }

  // === ინდიკატორის აწყობა (SVG პროგრეს-რგოლი + ისარი), მიბმული ეკრანთან (fixed) ===

  private createIndicator(): void {
    const wrapper = this.renderer.createElement('div');
    this.renderer.addClass(wrapper, 'ptr-indicator');
    this.renderer.setStyle(wrapper, 'opacity', '0');
    this.renderer.setStyle(wrapper, 'transform', 'translateX(-50%) scale(0.7)');

    const svgRing = this.renderer.createElement('svg', 'svg');
    this.renderer.setAttribute(svgRing, 'viewBox', '0 0 36 36');
    this.renderer.addClass(svgRing, 'ptr-ring');

    const track = this.renderer.createElement('circle', 'svg');
    this.renderer.setAttribute(track, 'cx', '18');
    this.renderer.setAttribute(track, 'cy', '18');
    this.renderer.setAttribute(track, 'r', '15');
    this.renderer.addClass(track, 'ptr-ring-track');

    const progressCircle = this.renderer.createElement('circle', 'svg');
    this.renderer.setAttribute(progressCircle, 'cx', '18');
    this.renderer.setAttribute(progressCircle, 'cy', '18');
    this.renderer.setAttribute(progressCircle, 'r', '15');
    this.renderer.addClass(progressCircle, 'ptr-ring-progress');
    this.renderer.setAttribute(progressCircle, 'stroke-dasharray', this.circumference.toString());
    this.renderer.setAttribute(progressCircle, 'stroke-dashoffset', this.circumference.toString());

    this.renderer.appendChild(svgRing, track);
    this.renderer.appendChild(svgRing, progressCircle);

    const arrow = this.renderer.createElement('svg', 'svg');
    this.renderer.setAttribute(arrow, 'viewBox', '0 0 24 24');
    this.renderer.addClass(arrow, 'ptr-arrow');
    const arrowPath = this.renderer.createElement('path', 'svg');
    this.renderer.setAttribute(arrowPath, 'd', 'M12 5v13M12 18l-5.5-5.5M12 18l5.5-5.5');
    this.renderer.appendChild(arrow, arrowPath);

    this.renderer.appendChild(wrapper, svgRing);
    this.renderer.appendChild(wrapper, arrow);

    // ეკრანთან მიბმული (fixed), დამოუკიდებელი კონტენტის სქროლ/pull ტრანსფორმაციისგან
    this.renderer.appendChild(document.body, wrapper);

    this.wrapperEl = wrapper;
    this.ringProgressEl = progressCircle;
    this.arrowEl = arrow;
  }

  private getScrollTop(): number {
    const el = this.el.nativeElement;
    const isElementScrollable = el.scrollHeight > el.clientHeight + 1;

    if (isElementScrollable) {
      return el.scrollTop;
    }

    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  private injectStylesOnce(): void {
    if (document.getElementById('ptr-global-styles')) {
      return;
    }

    const style = this.renderer.createElement('style');
    this.renderer.setAttribute(style, 'id', 'ptr-global-styles');
    style.textContent = `
      .ptr-indicator {
        position: fixed;
        top: 16px;
        left: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        border-radius: 50%;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.08);
        z-index: 9999;
        will-change: transform, opacity;
      }

      .ptr-ring {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .ptr-ring-track {
        fill: none;
        stroke: #e8ecf1;
        stroke-width: 2.5;
      }

      .ptr-ring-progress {
        fill: none;
        stroke: #0066ff;
        stroke-width: 2.5;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.05s linear, stroke 0.2s ease;
      }

      .ptr-arrow {
        position: relative;
        width: 18px;
        height: 18px;
        stroke: #7b8794;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.05s linear, opacity 0.2s ease, stroke 0.2s ease;
      }

      .ptr-indicator.ptr-ready .ptr-ring-progress {
        stroke: #14b866;
      }

      .ptr-indicator.ptr-ready .ptr-arrow {
        stroke: #14b866;
      }

      .ptr-indicator.ptr-spinning .ptr-ring {
        animation: ptr-rotate 0.85s linear infinite;
      }

      .ptr-indicator.ptr-spinning .ptr-ring-progress {
        stroke: #0066ff;
        stroke-dasharray: 70 25;
      }

      .ptr-indicator.ptr-spinning .ptr-arrow {
        opacity: 0;
      }

      @keyframes ptr-rotate {
        to { transform: rotate(270deg); }
      }
    `;
    this.renderer.appendChild(document.head, style);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.wrapperEl) {
      this.renderer.removeChild(document.body, this.wrapperEl);
    }
    // #ptr-global-styles დოკუმენტში რჩება - ის გლობალურია და შესაძლოა
    // სხვა instance-ებსაც სჭირდებოდეს; წაშლა საჭირო არ არის.
  }
}