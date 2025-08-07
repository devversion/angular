import {Component} from '@angular/core';

@Component({
  template: `
    <div>
      {{message}}
      @if (value()) {
        Primary block.
      } @else if (loadingMsg() as msg) {
        {{msg}}
      }
    </div>
  `,
  standalone: false,
})
export class MyApp {
  message = 'hello';
  loadingMsg: () => string | undefined = () => 'hello';
  value = () => 1;
}
