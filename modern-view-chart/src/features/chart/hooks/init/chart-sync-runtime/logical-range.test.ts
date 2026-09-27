import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAcceptLogicalRangeSource } from './logical-range';

test('price chart remains the canonical logical-range source', () => {
    assert.equal(shouldAcceptLogicalRangeSource('price', false, null), true);
    assert.equal(shouldAcceptLogicalRangeSource('price', true, 'sub'), true);
});

test('secondary panes cannot drive range from resize or setData side effects', () => {
    assert.equal(shouldAcceptLogicalRangeSource('sub', false, null), false);
    assert.equal(shouldAcceptLogicalRangeSource('foot', false, null), false);
});

test('secondary pane can drive range only during direct interaction with that pane', () => {
    assert.equal(shouldAcceptLogicalRangeSource('sub', true, 'sub'), true);
    assert.equal(shouldAcceptLogicalRangeSource('foot', true, 'foot'), true);
    assert.equal(shouldAcceptLogicalRangeSource('sub', true, 'foot'), false);
});
