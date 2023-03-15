import {Component, Input, input} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';

@Component({
  selector: 'greet',
  standalone: true,
  signals: true,
  template: `{{ nameInput() }}`,
})
export class Greet {
  nameInput = input<boolean|undefined>(undefined);
  internalName = input(true, {alias: 'publicNameYay'});

  // should break, but still supported early prototype.
  @Input() oldInput: string|undefined;
}

@Component({
  standalone: true,
  template: `Hello <greet [nameInput]="'A'" />`,
  imports: [Greet],
})
export class MyApp {
}

bootstrapApplication(MyApp).catch((e) => console.error(e));
