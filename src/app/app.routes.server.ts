import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'request/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'trip/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'register',
    renderMode: RenderMode.Client,
  },
  {
    path: 'forgot-password',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];