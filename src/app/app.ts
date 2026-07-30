import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar";
import {  FooterComponent } from "./footer/footer";
import { ToastNotificationsComponent } from './chat/toast-notifications-component/toast-notifications-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FooterComponent, NavbarComponent, ToastNotificationsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('gadazidva');
}
