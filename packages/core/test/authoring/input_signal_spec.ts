/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, computed, effect, ɵinput as input} from '@angular/core';
import {SIGNAL} from '@angular/core/primitives/signals';
import {TestBed} from '@angular/core/testing';

describe('input signal', () => {
  it('should properly notify live consumers (effect)', () => {
    @Component({template: ''})
    class TestCmp {
      input = input(0);
      effectCalled = 0;

      constructor() {
        effect(() => {
          this.effectCalled++;
          this.input();
        });
      }
    }

    const fixture = TestBed.createComponent(TestCmp);
    const node = fixture.componentInstance.input[SIGNAL];
    fixture.detectChanges();

    expect(fixture.componentInstance.effectCalled).toBe(1);

    node.applyValueToInputSignal(node, 1);
    fixture.detectChanges();
    expect(fixture.componentInstance.effectCalled).toBe(2);
  });

  it('should work with computed expressions', () => {
    const signal = input(0);
    let computedCount = 0;
    const derived = computed(() => (computedCount++, signal() + 1000));

    const node = signal[SIGNAL];
    expect(derived()).toBe(1000);
    expect(computedCount).toBe(1);

    node.applyValueToInputSignal(node, 1);
    expect(computedCount).toBe(1);

    expect(derived()).toBe(1001);
    expect(computedCount).toBe(2);
  });

  it('should support transforms', () => {
    const signal = input(0, {transform: (v: number) => v + 1000});
    const node = signal[SIGNAL];

    // initial value never runs with the transform.
    expect(signal()).toBe(0);

    node.applyValueToInputSignal(node, 1);
    expect(signal()).toBe(1001);
  });

  it('should throw if there is no value for required inputs', () => {
    const signal = input.required();
    const node = signal[SIGNAL];

    // initial value never runs with the transform.
    expect(() => signal()).toThrowError(/Input is required but no value is available yet\./);

    node.applyValueToInputSignal(node, 1);
    expect(signal()).toBe(1);
  });
});
