/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {runInEachFileSystem} from '../../src/ngtsc/file_system/testing';
import {loadStandardTestFiles} from '../helpers/src/mock_file_loading';
import {NgtscTestEnvironment} from './env';

const testFiles = loadStandardTestFiles();

runInEachFileSystem(() => {
  fdescribe('ngtsc inheritance tests', () => {
    let env!: NgtscTestEnvironment;

    beforeEach(() => {
      env = NgtscTestEnvironment.setup(testFiles);
      env.tsconfig();
    });

    beforeEach(() => {
      env.write('local.ts', `
        import {Component, Directive, Injectable, Pipe, ElementRef} from '@angular/core';

        export class BasePlain {}

        export class BasePlainWithBlankConstructor {
          constructor() {}
        }

        export class BasePlainWithConstructorParameters {
          constructor(elementRef: ElementRef) {}
        }

        @Component({
          selector: 'base-cmp',
          template: 'BaseCmp',
        })
        export class BaseCmp {}

        @Directive({
          selector: '[base]',
        })
        export class BaseDir {}
        
        @Pipe({name: 'base-pipe'})
        export class BasePipe {}
        
        @Injectable()
        export class BaseService {}
      `);

      env.write('lib.d.ts', `
        import {
          ɵɵComponentDefWithMeta,
          ɵɵDirectiveDefWithMeta,
          ɵɵPipeDefWithMeta,
          ɵɵInjectableDef,
          ElementRef
        } from '@angular/core';

        export declare class BasePlain {}

        export declare class BasePlainWithBlankConstructor {
          constructor() {}
        }

        export declare class BasePlainWithConstructorParameters {
          constructor(elementRef: ElementRef) {}
        }

        export declare class BaseCmp {
          static ɵcmp: ɵɵComponentDefWithMeta<BaseCmp, "base-cmp", never, {}, {}, never>
        }

        export declare class BaseDir {
          static ɵdir: ɵɵDirectiveDefWithMeta<BaseDir, '[base]', never, never, never, never>;
        }
        
        export declare class BasePipe {
          static ɵpipe: ɵɵPipeDefWithMeta<BasePipe, "base-pipe">;
        }
        
        export declare class BaseService {
          static ɵprov: ɵɵInjectableDef<BaseService>;
        }
      `);
    });

    it('should not error when inheriting a constructor from a decorated directive class', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Directive, Pipe, Injectable, Component} from '@angular/core';
        import {BaseDir, BaseCmp, BasePipe, BaseService} from './local';

        @Directive({
          selector: '[dir]',
        })
        export class Dir extends BaseDir {}

        @Component({
          selector: 'test-cmp',
          template: 'TestCmp',
        })
        export class Cmp extends BaseCmp {}
        
        @Pipe({name: 'my-pipe'})
        export class MyPipe extends BasePipe {}
        
        @Injectable()
        export class MyService extends BaseService {}
      `);
      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(0);
    });

    it('should not error when inheriting from a class without a constructor', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Directive, Injectable, Pipe, Component} from '@angular/core';
        import {BasePlain} from './local';

        @Directive({
          selector: '[dir]',
        })
        export class Dir extends BasePlain {}

        @Component({
          selector: 'test-cmp',
          template: 'TestCmp',
        })
        export class Cmp extends BasePlain {}
        
        @Pipe({name: 'my-pipe'})
        export class MyPipe extends BasePlain {}
        
        @Injectable()
        export class MyService extends BasePlain {}
      `);
      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(0);
    });

    it('should error when inheriting a constructor from an undecorated class', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Directive, Pipe, Injectable, Component} from '@angular/core';
        import {BasePlainWithConstructorParameters} from './local';

        @Directive({
          selector: '[dir]',
        })
        export class Dir extends BasePlainWithConstructorParameters {}

        @Component({
          selector: 'test-cmp',
          template: 'TestCmp',
        })
        export class Cmp extends BasePlainWithConstructorParameters {}
        
        @Pipe({name: 'my-pipe'})
        export class MyPipe extends BasePlainWithConstructorParameters {}
        
        @Injectable()
        export class MyService extends BasePlainWithConstructorParameters {}
      `);
      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(4);
      expect(diags[0].messageText).toContain('Dir');
      expect(diags[0].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[1].messageText).toContain('Cmp');
      expect(diags[1].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[2].messageText).toContain('Pipe');
      expect(diags[2].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[3].messageText).toContain('Service');
      expect(diags[3].messageText).toContain('BasePlainWithConstructorParameters');
    });

    it('should error when inheriting a constructor from undecorated grand super class', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Directive, Pipe, Injectable, Component} from '@angular/core';
        import {BasePlainWithConstructorParameters} from './local';

        class Parent extends BasePlainWithConstructorParameters {}

        @Directive({
          selector: '[dir]',
        })
        export class Dir extends Parent {}

        @Component({
          selector: 'test-cmp',
          template: 'TestCmp',
        })
        export class Cmp extends Parent {}
        
        @Pipe({name: 'my-pipe'})
        export class MyPipe extends Parent {}
        
        @Injectable()
        export class MyService extends Parent {}
      `);

      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(4);
      expect(diags[0].messageText).toContain('Dir');
      expect(diags[0].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[1].messageText).toContain('Cmp');
      expect(diags[1].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[2].messageText).toContain('MyPipe');
      expect(diags[2].messageText).toContain('BasePlainWithConstructorParameters');
      expect(diags[3].messageText).toContain('MyService');
      expect(diags[3].messageText).toContain('BasePlainWithConstructorParameters');
    });

    it('should error when inheriting a constructor from undecorated grand grand super class',
       () => {
         env.tsconfig();
         env.write('test.ts', `
            import {Directive, Pipe, Injectable, Component} from '@angular/core';
            import {BasePlainWithConstructorParameters} from './local';

            class GrandParent extends BasePlainWithConstructorParameters {}

            class Parent extends GrandParent {}

            @Directive({
              selector: '[dir]',
            })
            export class Dir extends Parent {}

            @Component({
              selector: 'test-cmp',
              template: 'TestCmp',
            })
            export class Cmp extends Parent {}
            
            @Pipe({name: 'my-pipe'})
            export class MyPipe extends Parent {}
        
            @Injectable()
            export class MyService extends Parent {}
          `);

         const diags = env.driveDiagnostics();
         expect(diags.length).toBe(4);
         expect(diags[0].messageText).toContain('Dir');
         expect(diags[0].messageText).toContain('BasePlainWithConstructorParameters');
         expect(diags[1].messageText).toContain('Cmp');
         expect(diags[1].messageText).toContain('BasePlainWithConstructorParameters');
         expect(diags[2].messageText).toContain('MyPipe');
         expect(diags[2].messageText).toContain('BasePlainWithConstructorParameters');
         expect(diags[3].messageText).toContain('MyService');
         expect(diags[3].messageText).toContain('BasePlainWithConstructorParameters');
       });

    it('should not error when inheriting a constructor from decorated directive or component classes in a .d.ts file',
       () => {
         env.tsconfig();
         env.write('test.ts', `
            import {Component, Pipe, Injectable, Directive} from '@angular/core';
            import {BaseDir, BaseCmp, BasePipe, BaseService} from './lib';

            @Directive({
              selector: '[dir]',
            })
            export class Dir extends BaseDir {}

            @Component({
              selector: 'test-cmp',
              template: 'TestCmp',
            })
            export class Cmp extends BaseCmp {}
            
            @Pipe({name: 'my-pipe'})
            export class MyPipe extends BasePipe {}
        
            @Injectable()
            export class MyService extends BaseService {}
         `);
         const diags = env.driveDiagnostics();
         expect(diags.length).toBe(0);
       });

    it('should error when inheriting a constructor from an undecorated class in a .d.ts file',
       () => {
         env.tsconfig();
         env.write('test.ts', `
            import {Directive, Component, Pipe, Injectable} from '@angular/core';

            import {BasePlainWithConstructorParameters} from './lib';

            @Directive({
              selector: '[dir]',
            })
            export class Dir extends BasePlainWithConstructorParameters {}
            
            @Component({
              selector: 'test-cmp',
              template: 'TestCmp',
            })
            export class Cmp extends BasePlainWithConstructorParameters {}
            
            @Pipe({name: 'my-pipe'})
            export class MyPipe extends BasePlainWithConstructorParameters {}
        
            @Injectable()
            export class MyService extends BasePlainWithConstructorParameters {}
          `);
         const diags = env.driveDiagnostics();
         expect(diags.length).toBe(4);
         expect(diags[0].messageText).toContain('Dir');
         expect(diags[0].messageText).toContain('Base');
         expect(diags[1].messageText).toContain('Cmp');
         expect(diags[1].messageText).toContain('Base');
         expect(diags[2].messageText).toContain('MyPipe');
         expect(diags[2].messageText).toContain('Base');
         expect(diags[3].messageText).toContain('MyService');
         expect(diags[3].messageText).toContain('Base');
       });

    it('should error when injectable inherits from non-injectable declaration', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Directive, Injectable} from '@angular/core';

        @Directive()
        class GrandParent {}
        
        class Parent extends GrandParent {}

        @Injectable()
        class MyService extends Parent {}
      `);

      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(1);
      expect(diags[0].messageText)
          .toBe(
              'Class MyService inherits from GrandParent. Classes ' +
              'using @Injectable cannot inherit from directives, components or pipes.');
    });

    it('should error when non-component declaration inherits from component', () => {
      env.tsconfig();
      env.write('test.ts', `
        import {Component, Directive, Pipe, Injectable} from '@angular/core';

        @Component({selector: 'grand-parent-cmp', template: 'test'})
        class GrandParent {}
        
        class Parent extends GrandParent {}

        @Injectable()
        class MyService extends Parent {}
        
        @Directive()
        class MyDir extends Parent {}
      
        @Pipe({name: 'test'})
        class MyPipe extends Parent {}
      `);

      const diags = env.driveDiagnostics();
      expect(diags.length).toBe(3);
      expect(diags[0].messageText)
          .toBe(
              'Class MyService inherits from GrandParent. Classes using @Directive, @Pipe or ' +
              '@Injectable cannot inherit from components.');
      expect(diags[1].messageText)
          .toBe(
              'Class MyDir inherits from GrandParent. Classes using @Directive, @Pipe or ' +
              '@Injectable cannot inherit from components.');
      expect(diags[2].messageText)
          .toBe(
              'Class MyPipe inherits from GrandParent. Classes using @Directive, @Pipe or ' +
              '@Injectable cannot inherit from components.');
    });

    describe('undecorated intermediary classes', () => {
      it('should error when intermediary base classes of @Directive are not decorated', () => {
        env.tsconfig();
        env.write('test.ts', `
        import {Directive, Component} from '@angular/core';
        import {BaseDir} from './local';

        class GrandParent extends BaseDir {}
        class Parent extends GrandParent {}

        @Directive({
          selector: '[dir]',
        })
        export class Dir extends Parent {}

        @Component({
          selector: 'test-cmp',
          template: 'TestCmp',
        })
        export class Cmp extends Parent {}
      `);

        const diags = env.driveDiagnostics();
        expect(diags.length).toBe(2);
        expect(diags[0].messageText)
            .toContain(
                'Class Parent uses Angular features as it extends from BaseDir. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Directive ' +
                'decorator.');
        expect(diags[1].messageText)
            .toContain(
                'Class GrandParent uses Angular features as it extends from BaseDir. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Directive ' +
                'decorator.');
      });

      it('should error when intermediary base classes of @Injectable are not decorated', () => {
        env.tsconfig();
        env.write('test.ts', `
        import {Injectable} from '@angular/core';

        @Injectable()
        class Base {}
        class GrandParent extends Base {}
        class Parent extends GrandParent {}

        @Injectable()
        export class MyService extends Parent {}

        @Injectable()
        export class MyService2 extends Parent {}
      `);

        const diags = env.driveDiagnostics();
        expect(diags.length).toBe(2);
        expect(diags[0].messageText)
            .toContain(
                'Class Parent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Injectable ' +
                'decorator.');
        expect(diags[1].messageText)
            .toContain(
                'Class GrandParent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Injectable ' +
                'decorator.');
      });

      it('should error when intermediary base classes of @Pipe are not decorated', () => {
        env.tsconfig();
        env.write('test.ts', `
        import {Pipe} from '@angular/core';

        @Pipe({name: 'base-pipe'})
        class Base {}
        class GrandParent extends Base {}
        class Parent extends GrandParent {}

        @Pipe({name: 'pipe-1'})
        export class MyPipe extends Parent {}

        @Pipe({name: 'pipe-2'})
        export class MyPipe2 extends Parent {}
      `);

        const diags = env.driveDiagnostics();
        expect(diags.length).toBe(2);
        expect(diags[0].messageText)
            .toContain(
                'Class Parent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Pipe ' +
                'decorator.');
        expect(diags[1].messageText)
            .toContain(
                'Class GrandParent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Pipe ' +
                'decorator.');
      });

      it('should error when intermediary base classes of @Component are not decorated', () => {
        env.tsconfig();
        env.write('test.ts', `
        import {Component} from '@angular/core';

        @Component({selector: 'base', template: 'base'})
        class Base {}
        class GrandParent extends Base {}
        class Parent extends GrandParent {}

        @Component({selector: 'my-comp', template: 'my-comp'})
        export class MyComp extends Parent {}

        @Component({selector: 'my-comp2', template: 'my-comp2'})
        export class MyComp2 extends Parent {}
      `);

        const diags = env.driveDiagnostics();
        expect(diags.length).toBe(2);
        expect(diags[0].messageText)
            .toContain(
                'Class Parent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Component ' +
                'decorator.');
        expect(diags[1].messageText)
            .toContain(
                'Class GrandParent uses Angular features as it extends from Base. Classes which ' +
                'inherit Angular features from other classes need to be decorated. Add a @Component ' +
                'decorator.');
      });
    });
  });
});
