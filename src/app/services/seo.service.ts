import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
}

const DEFAULT_OG_IMAGE = 'https://ggzavna.ge/assets/og-default.jpg';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private titleService = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);

  update(data: SeoData) {
    const { title, description, image, url, type = 'website', noindex } = data;
    const finalImage = image || DEFAULT_OG_IMAGE; // ⬅️ fallback დამატებულია

    this.titleService.setTitle(title);

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:locale', content: 'ka_GE' });
    this.meta.updateTag({ property: 'og:site_name', content: 'გგზავნა' });
    this.meta.updateTag({ property: 'og:image', content: finalImage }); // ⬅️ ყოველთვის იქნება

    if (url) this.meta.updateTag({ property: 'og:url', content: url });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: finalImage });

    this.meta.updateTag({
      name: 'robots',
      content: noindex ? 'noindex, nofollow' : 'index, follow',
    });

    if (url) this.updateCanonical(url);
  }

  private updateCanonical(url: string) {
    let link = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  setJsonLd(data: object | object[]) {
    const existing = this.document.getElementById('json-ld');
    if (existing) existing.remove();

    const script = this.document.createElement('script');
    script.id = 'json-ld';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  /** ბრეადქრამბის JSON-LD — გამოსადეგი request/trip დეტალის გვერდებზე */
  setBreadcrumb(items: { name: string; url: string }[]) {
    const existing = this.document.getElementById('json-ld-breadcrumb');
    if (existing) existing.remove();

    const script = this.document.createElement('script');
    script.id = 'json-ld-breadcrumb';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    });
    this.document.head.appendChild(script);
  }
}