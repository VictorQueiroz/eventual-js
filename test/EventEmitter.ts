import assert from 'assert';
import timers from 'timers';
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

suite.test('it should wait promises returned by each listener', () => {
  const e = new EventEmitter<{ a: number }>();
  const database = {
    records: new Array<number>(),
    async get(value: number) {
      return new Promise<boolean>((resolve) => {
        timers.setTimeout(() => {
          resolve(this.records.includes(value));
        }, 0);
      });
    },
    async add(value: number) {
      return new Promise<void>((resolve) => {
        timers.setTimeout(() => {
          this.records.push(value);
          resolve();
        }, 0);
      });
    },
  };
  e.on('a', async (value) => {
    await database.add(value);
  });
  e.on('a', async (value) => {
    assert.strict.ok(await database.get(value));
  });
  e.emit('a', 1);
  e.emit('a', 2);
});

suite.test(
  'it should work if the same reference is used when queueing event dispatches',
  () => {
    const obj = {};
    const e = new EventEmitter<{ a: {} }>();
    e.emit('a', obj);
    e.emit('a', obj);
    e.emit('a', obj);
    e.emit('a', obj);
    const fn = spy((_: {}) => {});
    e.on('a', fn);
    assert.strict.ok(fn.calledWithExactly(obj));
    assert.strict.ok(fn.calledWithExactly(obj));
    assert.strict.ok(fn.calledWithExactly(obj));
    assert.strict.ok(fn.calledWithExactly(obj));
  }
);

suite.test('it should attach two event listeners to the same event', () => {
  const l1 = () => {};
  const l2 = () => {};
  const e = new EventEmitter<{ a: {} }>();
  e.on('a', l1);
  e.on('a', l2);
});

export default suite;
