import { Routes } from '@angular/router';
import { HomeComponent } from './Main/home/home';
import { NavbarComponent } from './Main/navbar/navbar';
import { FooterComponent } from './Main/footer/footer';
import { HowToWorkComponent } from './Main/howtowork/howtowork';
import { RulesComponent } from './Main/rules/rules';
import { LoginComponent } from './Register Login forgortpassword/login-component/login-component';
import { RegisterComponent } from './Register Login forgortpassword/registercomponent/registercomponent';
import { ForgotPasswordComponent } from './Register Login forgortpassword/forgot-password/forgot-password';
import { SendParcelComponent } from '../app/Product-Colection/send-parcel-component/send-parcel-component';
import { PickupParcelComponent } from '../app/Product-Colection/pickup-parcel-component/pickup-parcel-component';
import { RequestDetailComponent } from './Product-Colection/send-detail-component/request-detail-component';
import { TripDetailComponent } from './Product-Colection/trip-detail-component/trip-detail-component';
import { adminRoutes } from './admin-panel/Admin.routes';
import { AllListingsComponent } from './Product-Colection/all-listings-component/all-listings-component';

// ძველი (ვებ)
import { SenderProfileComponent } from './profile-component/sender-profile-component/sender-profile-component';
import { DriverProfileComponent } from './profile-component/driver-profile-component/driver-profile-component';

// ახალი Android სტილის
import { SenderProfileAndroidComponent } from './android-components/sender-profile-android-component/sender-profile-android-component';
import { DriverProfileAndroidComponent } from './android-components/driver-profile-android-component/driver-profile-android-component';

// სმარტ პროფილი (როლის მიხედვით)
import { ProfileRedirectComponent } from './android-components/profile-redirect/profile-redirect';
import { AndroidLoginComponent } from './android-components/android-login-component/android-login-component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'howtowork', component: HowToWorkComponent },
  { path: 'navbar', component: NavbarComponent },
  { path: 'footer', component: FooterComponent },
  { path: 'rules', component: RulesComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'android-login', component: AndroidLoginComponent },

  // ===== პროფილები =====
  // ვებისთვის
  { path: 'senderProfile', component: SenderProfileComponent },
  { path: 'driverProfile', component: DriverProfileComponent },

  // Android / Native
  { path: 'senderProfile-android', component: SenderProfileAndroidComponent },
  { path: 'driverProfile-android', component: DriverProfileAndroidComponent },

  // სმარტ როუთი — Bottom Navbar
  { path: 'profile', component: ProfileRedirectComponent },

  // ===== დანარჩენი =====
  { path: 'send', component: SendParcelComponent },
  { path: 'pickup', component: PickupParcelComponent },
  { path: 'request/:id', component: RequestDetailComponent },
  { path: 'trip/:id', component: TripDetailComponent },
  ...adminRoutes,
  { path: 'listing', component: AllListingsComponent },

  { path: '**', redirectTo: 'home' }
];