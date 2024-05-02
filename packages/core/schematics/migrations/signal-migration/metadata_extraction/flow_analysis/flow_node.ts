import ts from 'typescript';

export function traverseToFlowStart(reference: ts.Node, flow: ts.FlowNode): ts.FlowStart | null {
  let flowDepth = 0;
  while (true) {
    flowDepth++;
    if (flowDepth === 2000) {
      // We have made 2000 recursive invocations. To avoid overflowing the call stack we report an
      // error and disable further control flow analysis in the containing function or module body.
      return null;
    }
    const flags = flow.flags;
    if (flags & ts.FlowFlags.Assignment) {
      flow = (flow as ts.FlowAssignment).antecedent;
      continue;
    } else if (flags & ts.FlowFlags.Call) {
      flow = (flow as ts.FlowCall).antecedent;
      continue;
    } else if (flags & ts.FlowFlags.Condition) {
      flow = (flow as ts.FlowCondition).antecedent;
    } else if (flags & ts.FlowFlags.SwitchClause) {
      flow = (flow as ts.FlowSwitchClause).antecedent;
    } else if (flags & ts.FlowFlags.Label) {
      // always pick first branch. At some point all antecedents
      // have the same parent.
      flow = (flow as ts.FlowLabel).antecedents![0];
    } else if (flags & ts.FlowFlags.ArrayMutation) {
      flow = (flow as ts.FlowArrayMutation).antecedent;
    } else if (flags & ts.FlowFlags.ReduceLabel) {
      // reduce label is a try/catch re-routing.
      flow = (flow as ts.FlowReduceLabel).antecedent;
    } else if (flags & ts.FlowFlags.Start) {
      // Check if we should continue with the control flow of the containing function.
      const container = (flow as ts.FlowStart).node;
      if (
        container &&
        reference.kind !== ts.SyntaxKind.PropertyAccessExpression &&
        reference.kind !== ts.SyntaxKind.ElementAccessExpression &&
        !(
          reference.kind === ts.SyntaxKind.ThisKeyword &&
          container.kind !== ts.SyntaxKind.ArrowFunction
        )
      ) {
        flow = (container as {flowNode?: ts.FlowNode}).flowNode!;
        continue;
      }
      return flow as ts.FlowStart;
    } else {
      // Unreachable code errors are reported in the binding phase. Here we
      // simply return the non-auto declared type to reduce follow-on errors.
      return null;
    }
  }
}

export function getFlowNode(node: ts.FlowContainer & {flowNode?: ts.FlowNode}): ts.FlowNode | null {
  return node.flowNode ?? null;
}

export function debugFlowFlags(flags: ts.FlowFlags) {
  return Object.values(ts.FlowFlags)
    .filter<number>((v): v is number => !isNaN(Number(v)))
    .map((v: number) => ((flags & v) !== 0 ? ts.FlowFlags[v] : null))
    .filter((v) => v !== null);
}
