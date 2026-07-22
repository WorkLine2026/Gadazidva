import { Routes } from '@angular/router';
import { HomeComponent } from './home//home';
import { NavbarComponent } from './navbar/navbar';
import { FooterComponent} from './footer/footer';
import { HowToWorkComponent } from './howtowork/howtowork';
import {  RulesComponent } from './rules/rules';
import { LoginComponent } from './Register Login forgortpassword/login-component/login-component';
import { RegisterComponent } from './Register Login forgortpassword/registercomponent/registercomponent';
import { ForgotPasswordComponent } from './Register Login forgortpassword/forgot-password/forgot-password';

import { ProfileComponent } from '../app/profile-component/profile-component';
import { SendParcelComponent } from '../app/profile-component/send-parcel-component/send-parcel-component';
import { PickupParcelComponent } from '../app/profile-component/pickup-parcel-component/pickup-parcel-component';
import { RequestDetailComponent } from './profile-component/request-detail-component/request-detail-component';
import { TripDetailComponent } from './profile-component/trip-detail-component/trip-detail-component';

export const routes: Routes = [
    // ========== PUBLIC ROUTES ==========
    {
        path: '', component: HomeComponent
    },
    {
        path: 'home', component: HomeComponent
    },
    {
        path: 'howtowork', component: HowToWorkComponent
    },
    {
        path: 'navbar', component: NavbarComponent
    },
    {
        path: 'footer', component: FooterComponent
    },
    {
        path: 'rules', component: RulesComponent
    },
    
    // ========== AUTH ROUTES ==========
    {
        path: 'login', component: LoginComponent
    },
    {
        path: 'register', component: RegisterComponent
    },
    {
        path: 'forgot-password', component: ForgotPasswordComponent
    },
    
   
    {
        path: 'profile', component: ProfileComponent
    },
    {
        path: 'send', component: SendParcelComponent
    },
     {
        path: 'pickup', component: PickupParcelComponent
     },

    { path: 'request/:id',
        component: RequestDetailComponent
    },
    { path: 'trip/:id',
        component: TripDetailComponent
    },
    
    // ========== WILDCARD (404) ==========
    {
        path: '**', redirectTo: 'home'
    }
];