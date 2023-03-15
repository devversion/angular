import {Signal, signal} from '../core_reactivity_export_internal';

export interface InputOptions {
  required?: boolean;
  alias?: string;
}

export function input<T>(): Signal<T|undefined>;
export function input<T>(defaultVal: T, opts?: InputOptions): Signal<T>;
export function input<T>(defaultVal?: T, opts?: InputOptions) {
  // opts: runtime info? jit?
  return signal(defaultVal);
}
