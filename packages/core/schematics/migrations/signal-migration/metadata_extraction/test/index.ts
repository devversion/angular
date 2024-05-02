import {Component, Input} from '@angular/core';


interface Vehicle {}
interface Car extends Vehicle {
  __car: true;
}
interface Porsche extends Car {
  __porsche: true;
}

@Component({
  selector: 'app-component',
  templateUrl: './template.html',
})
export class AppComponent {
  @Input() input: string|null = null;
  @Input({transform: disabledTransform, required: true}) bla: boolean = false;
  @Input() narrowableMultipleTimes: Vehicle|null = null;

  someControlFlowCase() {
    if (this.input) {
      this.input.charAt(0);
    }
  }

  moreComplexControlFlowCase() {
    if (!this.input) {
      return;
    }

    this.doSomething();

    (() => {
      // might be a different input value now?!
      console.log(this.input.substring(0));
    })();
  }

  doSomething() {
    this.input = 'some other value';
  }

  allTheSameNoNarrowing() {
    console.log(this.input);
    console.log(this.input);
  }

  test() {
    if (this.narrowableMultipleTimes) {
      console.log();

      const x = () => {
        if (isCar(this.narrowableMultipleTimes)) {
        };
      };

      console.log();
      console.log()
      x();
      x();
    }
  }

  extremeNarrowingNested() {
    if (this.narrowableMultipleTimes && isCar(this.narrowableMultipleTimes)) {
      this.narrowableMultipleTimes.__car;

      let car = this.narrowableMultipleTimes;
      let ctx = this;

      function nestedFn() {
        if (isPorsche(car)) {
          console.log(car.__porsche);
        }
        if (!isCar(ctx.narrowableMultipleTimes!) || !isPorsche(ctx.narrowableMultipleTimes)) {
          return;
        }

        ctx.narrowableMultipleTimes.__porsche;
      }

      // iife
      (() => {
        if (isPorsche(this.narrowableMultipleTimes)) {
          this.narrowableMultipleTimes.__porsche;
        }
      })();
    }
  }
}


function disabledTransform(bla: string|boolean): boolean {
  return true;
}

function isCar(v: Vehicle): v is Car {
  return true;
}

function isPorsche(v: Car): v is Porsche {
  return true;
}

const x: AppComponent = null!;
x.input = true;
