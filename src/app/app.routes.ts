import { Routes } from '@angular/router';
import { HomeComponent } from './home//home';
import { NavbarComponent } from './navbar/navbar';
import { FooterComponent} from './footer/footer';
import { HowToWorkComponent } from './howtowork/howtowork';
import {  RulesComponent } from './rules/rules';
export const routes: Routes = [
    {
        path: '', component: HomeComponent
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
    }

];
