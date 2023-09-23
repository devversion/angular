/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, EmbeddedViewRef, Injector, Input, OnChanges, SimpleChange, SimpleChanges, TemplateRef, ViewContainerRef} from '@angular/core';

/**
 * @ngModule CommonModule
 *
 * @description
 *
 * Inserts an embedded view from a prepared `TemplateRef`.
 *
 * You can attach a context object to the `EmbeddedViewRef` by setting `[ngTemplateOutletContext]`.
 * `[ngTemplateOutletContext]` should be an object, the object's keys will be available for binding
 * by the local template `let` declarations.
 *
 * @usageNotes
 * ```
 * <ng-container *ngTemplateOutlet="templateRefExp; context: contextExp"></ng-container>
 * ```
 *
 * Using the key `$implicit` in the context object will set its value as default.
 *
 * ### Example
 *
 * {@example common/ngTemplateOutlet/ts/module.ts region='NgTemplateOutlet'}
 *
 * @publicApi
 */
@Directive({
  selector: '[ngTemplateOutlet]',
  standalone: true,
})
export class NgTemplateOutlet implements OnChanges {
  private _viewRef: EmbeddedViewRef<any>|null = null;

  /**
   * A context object to attach to the {@link EmbeddedViewRef}. This should be an
   * object, the object's keys will be available for binding by the local template `let`
   * declarations.
   * Using the key `$implicit` in the context object will set its value as default.
   */
  @Input() public ngTemplateOutletContext: Object|null = null;

  /**
   * A string defining the template reference and optionally the context object for the template.
   */
  @Input() public ngTemplateOutlet: TemplateRef<any>|null = null;

  /** Injector to be used within the embedded view. */
  @Input() public ngTemplateOutletInjector: Injector|null = null;

  constructor(private _viewContainerRef: ViewContainerRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (this._shouldRecreateView(changes)) {
      const viewContainerRef = this._viewContainerRef;

      if (this._viewRef) {
        viewContainerRef.remove(viewContainerRef.indexOf(this._viewRef));
      }

      // If there is no outlet, clear the destroyed view ref.
      if (!this.ngTemplateOutlet) {
        this._viewRef = null;
        return;
      }

      // For a given outlet instance, we create a proxy object that delegates
      // to the user-specified context. This allows changing, or swapping out
      // the context object completely without having to destroy/re-create the view.
      const proxyContext = new Proxy({}, {
        get: (_target, prop, receiver) => {
          if (!this.ngTemplateOutletContext) {
            return undefined;
          }
          return Reflect.get(this.ngTemplateOutletContext, prop, receiver);
        },
      });

      this._viewRef = viewContainerRef.createEmbeddedView(this.ngTemplateOutlet, proxyContext, {
        injector: this.ngTemplateOutletInjector ?? undefined,
      });
    }
  }

  /**
   * We need to re-create existing embedded view if:
   * - templateRef has changed
   * - context has changed (NOT TRUE ANYMORE)
   * - the injector changed.
   *
   * We treat the context object as changed when the corresponding object
   * shape changes (new properties are added or existing properties are removed).
   * In other words we consider context with the same properties as "the same" even
   * if object reference changes (see https://github.com/angular/angular/issues/13407).
   */
  private _shouldRecreateView(changes: SimpleChanges): boolean {
    const outletChange = changes['ngTemplateOutlet'];
    const injectorChange = changes['ngTemplateOutletInjector'];

    return !!outletChange || !!injectorChange;
  }
}
