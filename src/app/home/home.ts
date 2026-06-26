import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface ParcelForm {
  from: string;
  to: string;
  date: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
}

interface Badge {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent implements OnInit {
  senderForm: ParcelForm = {
    from: '',
    to: '',
    date: '',
  };

  driverForm: ParcelForm = {
    from: '',
    to: '',
    date: '',
  };

  steps: Step[] = [
    {
      id: 1,
      title: 'დარეგისტრირდი',
      description: 'სწრაფი და უსაფრთხო ავტორიზაცია',
    },
    {
      id: 2,
      title: 'შეავსე ფორმა',
      description: 'მიუთითე მონაცემები სულ რამდენიმე წამში',
    },
    {
      id: 3,
      title: 'დაიწყე მგზავრობა',
      description: 'იპოვე სასურველი მძღოლი ან გაგზავნე ამანათი',
    },
    
  ];

  steps1: Step[] = [
    {
      id: 1,
      title: 'დარეგისტრირდი',
      description: 'სწრაფი და უსაფრთხო ავტორიზაცია',
    },
    {
      id: 2,
      title: 'შეავსე ფორმა',
      description: 'მიუთითე მონაცემები სულ რამდენიმე წამში',
    },
    {
      id: 3,
      title: 'და გააგზავნე ამანათი',
      description: 'იპოვე სასურველი მძღოლი ან გაგზავნე ამანათი',
    },
    
  ];


  badges: Badge[] = [
    {
      icon: '✓',
      text: '100% დაზღვეული ტრანზაქციები',
    },
    {
      icon: '🔒',
      text: 'შენი მონაცემები სრულად დაცულია',
    },
    {
      icon: '⚡',
      text: 'სწრაფი მიწოდების სერვისი',
    },
    {
      icon: '💳',
      text: 'გადახდის მოხერხებული მეთოდები',
    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Component initialization if needed
  }

  /**
   * Send parcel from quick form
   */
  sendParcel(): void {
    if (this.validateSenderForm()) {
      // Store form data in sessionStorage
      sessionStorage.setItem(
        'parcelData',
        JSON.stringify(this.senderForm)
      );
      // Navigate to send page
      this.navigateToSend();
    }
  }

  /**
   * Become a driver from quick form
   */
  becomeDriver(): void {
    if (this.validateDriverForm()) {
      // Store form data in sessionStorage
      sessionStorage.setItem(
        'driverData',
        JSON.stringify(this.driverForm)
      );
      // Navigate to driver page
      this.navigateToDrive();
    }
  }

  /**
   * Navigate to full send form
   */
  navigateToSend(): void {
    this.router.navigate(['/send']);
  }

  /**
   * Navigate to full driver form
   */
  navigateToDrive(): void {
    this.router.navigate(['/drive']);
  }

  /**
   * Validate sender form
   */
  private validateSenderForm(): boolean {
    if (!this.senderForm.from.trim()) {
      alert('გთხოვთ, მიუთითოთ გამგზავრების ქალაქი');
      return false;
    }
    if (!this.senderForm.to.trim()) {
      alert('გთხოვთ, მიუთითოთ დანიშნულების ქალაქი');
      return false;
    }
    if (!this.senderForm.date) {
      alert('გთხოვთ, აირჩიოთ თარიღი');
      return false;
    }
    return true;
  }

  /**
   * Validate driver form
   */
  private validateDriverForm(): boolean {
    if (!this.driverForm.from.trim()) {
      alert('გთხოვთ, მიუთითოთ გამგზავრების ქალაქი');
      return false;
    }
    if (!this.driverForm.to.trim()) {
      alert('გთხოვთ, მიუთითოთ დანიშნულების ქალაქი');
      return false;
    }
    if (!this.driverForm.date) {
      alert('გთხოვთ, აირჩიოთ თარიღი');
      return false;
    }
    return true;
  }
}