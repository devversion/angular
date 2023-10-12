import {ERRORED, producerAccessed, producerUpdateValueVersion, SIGNAL} from '@angular/core/primitives/signals';

import {INPUT_SIGNAL_NODE, InputSignal, InputSignalNode} from './input_signal';

export interface PrimaryInputOptions<ReadT, WriteT> {
  alias?: string;
  transform?: (value: WriteT) => ReadT;
}

export interface InputOptions<ReadT, WriteT> extends PrimaryInputOptions<ReadT, WriteT> {
  initialValue?: WriteT;
  required?: boolean;
}

export function input(): InputSignal<undefined, undefined>;
export function input<T>(): InputSignal<T|undefined, T>;
export function input<T>(
    initialValue: T&(string | number | boolean),
    opts?: PrimaryInputOptions<T, T>&{transform?: undefined}): InputSignal<T, T>;
export function input<ReadT, WriteT = ReadT>(
    initialValue: WriteT&(string | number | boolean),
    opts: PrimaryInputOptions<ReadT, WriteT>): InputSignal<ReadT, WriteT>;
export function input<T>(opts: InputOptions<T, T>&
                         {required: true, transform?: undefined}): InputSignal<T, T>;
export function input<ReadT, WriteT = ReadT>(opts: InputOptions<ReadT, WriteT>&
                                             {required: true}): InputSignal<ReadT, WriteT>;
export function input<T>(opts: InputOptions<T, T>&
                         {initialValue: T, transform?: undefined}): InputSignal<T, T>;
export function input<ReadT, WriteT = ReadT>(opts: InputOptions<ReadT, WriteT>&
                                             {initialValue: ReadT}): InputSignal<ReadT, WriteT>;
export function input<ReadT, WriteT = ReadT>(opts: InputOptions<ReadT, WriteT>):
    InputSignal<ReadT|undefined, WriteT>;
export function input<ReadT, WriteT>(opts?: InputOptions<ReadT, WriteT>):
    InputSignal<ReadT, WriteT> {
  const node: InputSignalNode<ReadT, WriteT> = Object.create(INPUT_SIGNAL_NODE);

  opts?.transform && (node.transform = opts.transform);
  opts?.initialValue && (node.value = node.transform(opts.initialValue));

  function inputValueFn() {
    // Check if the value needs updating before returning it.
    producerUpdateValueVersion(node);

    // Record that someone looked at this signal.
    producerAccessed(node);

    if (node.value === ERRORED) {
      throw node.error;
    }

    return node.value;
  }

  (inputValueFn as any)[SIGNAL] = node;

  return inputValueFn as InputSignal<ReadT, WriteT>;
}
