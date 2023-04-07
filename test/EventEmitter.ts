import assert from 'assert';
import { EventEmitter } from '../src';
import { Suite } from 'sarg';
import { spy } from 'sinon';

const suite = new Suite();

suite.test('it should queue event dispatches if no listener was added', () => {
  const fn = spy((_: number) => {});
  const e = new EventEmitter<{ a: number }>();
  e.emit('a', 1);
  e.emit('a', 2);
  e.emit('a', 3);
  e.emit('a', 4);
  assert.strict.ok(fn.notCalled);
  e.on('a', fn);
  assert.strict.ok(fn.calledWithExactly(1));
  assert.strict.ok(fn.calledWithExactly(2));
  assert.strict.ok(fn.calledWithExactly(3));
  assert.strict.ok(fn.calledWithExactly(4));
});

suite.test(
  'it should not queue event dispatches if there are listener added',
  () => {
    const fn = spy((_: number) => {});
    const e = new EventEmitter<{ a: number }>();
    e.on('a', fn);
    assert.strict.ok(fn.notCalled);
    e.emit('a', 1);
    e.emit('a', 2);
    e.emit('a', 3);
    e.emit('a', 4);
    assert.strict.ok(fn.calledWithExactly(1));
    assert.strict.ok(fn.calledWithExactly(2));
    assert.strict.ok(fn.calledWithExactly(3));
    assert.strict.ok(fn.calledWithExactly(4));
  }
);

export default suite;
