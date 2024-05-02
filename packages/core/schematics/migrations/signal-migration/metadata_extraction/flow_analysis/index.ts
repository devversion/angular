import ts from 'typescript';

import {getFlowNode, traverseToFlowStart} from './flow_node';

export type ControlFlowNodeIndex = number;

export interface ControlFlowAnalysisNode {
  id: number;
  originalNode: ts.Identifier;
  recommendedNode: ControlFlowNodeIndex | 'preserve-not-narrowed';
  willBeShared: boolean;
}

interface FlowContainerInfo {
  nodes: ts.Identifier[];
  id: number;
}

export function analyzeControlFlow(
  targetType: ts.Type,
  entries: ts.Identifier[],
  typeChecker: ts.TypeChecker,
): ControlFlowAnalysisNode[] {
  const flowContainers = new Map<ts.FlowStart, FlowContainerInfo>();
  const result: ControlFlowAnalysisNode[] = [];

  for (const [idx, entry] of entries.entries()) {
    const flowNode = getFlowNode(entry);
    const startNode = flowNode !== null ? traverseToFlowStart(entry, flowNode) : null;

    if (startNode === null) {
      throw new Error('Assertion Error: No flow container');
    }

    let shareReferenceId;
    const existingFlowContainer = flowContainers.get(startNode);

    if (existingFlowContainer !== undefined) {
      existingFlowContainer.nodes.push(entry);
      shareReferenceId = existingFlowContainer.id;
    } else {
      shareReferenceId = idx;
      flowContainers.set(startNode, {nodes: [entry], id: idx});
    }

    // Only check if the type got narrowed, via expensive type checking, if we know there
    // is an existing node in a shared flow container.
    const isNarrowed =
      existingFlowContainer !== undefined && targetType !== typeChecker.getTypeAtLocation(entry);

    if (isNarrowed) {
      result[existingFlowContainer.id].willBeShared = true;
    }

    result.push({
      id: idx,
      originalNode: entry,
      willBeShared: false,
      recommendedNode: isNarrowed ? shareReferenceId : 'preserve-not-narrowed',
    });
  }

  return result;
}
