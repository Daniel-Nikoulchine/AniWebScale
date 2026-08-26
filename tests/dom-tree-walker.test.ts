import { describe, expect, it } from 'vitest';
import { walkElementTree } from '../src/core/dom-tree-walker';

type FakeElement = {
  name: string;
  children?: FakeElement[];
  shadowRoot?: { children: FakeElement[] };
};

describe('walkElementTree', () => {
  it('visits light-DOM descendants and shadow-DOM descendants once', () => {
    const tree: FakeElement = {
      name: 'host',
      children: [{ name: 'light-child' }],
      shadowRoot: { children: [{ name: 'shadow-child', children: [{ name: 'nested' }] }] },
    };
    const visited: string[] = [];

    walkElementTree(tree as unknown as Element, element => {
      visited.push((element as unknown as FakeElement).name);
    });

    expect(visited).toEqual(['host', 'shadow-child', 'nested', 'light-child']);
  });
});
