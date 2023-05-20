import assert from 'assert';
import timers from 'timers';
import { EventEmitter } from '../src';
import { Suite } from 'sarg';
import { spy } from 'sinon';
import Logger from '@jscriptlogger/lib';
import sinon from 'sinon';

const suite = new Suite();

async function wait(ms: number) {
  return new Promise<void>((resolve) => {
    timers.setTimeout(() => {
      resolve();
    }, ms);
  });
}

suite.test('it should work if you pass an interface to it', () => {
  interface IEventMap {
    a: string;
    b: number;
  }
  new EventEmitter<IEventMap>();
});

suite.test(
  'it should support emitting the same event inside event emitter listener',
  async () => {
    const fn = spy((_: number) => {});
    const e = new EventEmitter<{ a: number }>();
    e.on('a', fn).on('a', (value) => {
      if (value >= 0) {
        e.emit('a', value - 1);
      }
    });
    e.emit('a', 4);
    await e.wait();
    console.log(fn.args);
  }
);

suite.test(
  'it should queue event dispatches if no listener was added',
  async () => {
    const fn = spy((_: number) => {});
    const e = new EventEmitter<{ a: number }>();
    e.emit('a', 1);
    e.emit('a', 2);
    e.emit('a', 3);
    e.emit('a', 4);
    assert.strict.ok(fn.notCalled);
    e.on('a', fn);
    await e.wait();
    assert.strict.ok(fn.calledWithExactly(1));
    assert.strict.ok(fn.calledWithExactly(2));
    assert.strict.ok(fn.calledWithExactly(3));
    assert.strict.ok(fn.calledWithExactly(4));
  }
);

suite.test(
  'it should not queue event dispatches if there are listener added',
  async () => {
    const fn = spy((_: number) => {});
    const e = new EventEmitter<{ a: number }>();
    e.on('a', fn);
    assert.strict.ok(fn.notCalled);
    e.emit('a', 1);
    e.emit('a', 2);
    e.emit('a', 3);
    e.emit('a', 4);
    await e.wait();
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
  async () => {
    const obj = {};
    const e = new EventEmitter<{ a: {} }>();
    e.emit('a', obj);
    e.emit('a', obj);
    e.emit('a', obj);
    e.emit('a', obj);
    const fn = spy((_: {}) => {});
    e.on('a', fn);
    await e.wait();
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

suite.test(
  'it should log if the event listener returns a rejected promise',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
    });
    e.on('a', () => Promise.reject(null));
    e.emit('a', 1);
    await e.wait();
    assert.strict.ok(
      customConsole.error.calledOnceWithExactly(
        'EventEmitter: event listener returned a promise that was rejected with error: %o',
        null
      )
    );
  }
);

suite.test(
  'it should log if listener show a synchronous failure as well',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
    });
    e.on('a', () => {
      throw 1;
    });
    e.emit('a', 1);
    await e.wait();
    assert.strict.ok(
      customConsole.error.calledOnceWithExactly(
        'EventEmitter: event listener call threw an exception: %o',
        1
      )
    );
  }
);

suite.test(
  'EventEmitter#resume: it should log if resume is called when it is already in resume state',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
    });
    e.resume();
    await e.wait();
    assert.strict.ok(
      customConsole.error.calledOnceWithExactly(
        'EventEmitter: resume was called, but event emitter was in stopped state'
      )
    );
  }
);

suite.test(
  'EventEmitter#pause: it should log if pause is called when event emitter is already paused',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
    });
    e.pause();
    e.pause();
    assert.strict.ok(
      customConsole.error.calledOnceWithExactly(
        'EventEmitter: pause called when event emitter was already stopped'
      )
    );
  }
);

suite.test(
  'it should resolve the listener if it takes longer than max wait time',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
      maxListenerWaitTime: 10,
    });
    const listener = () =>
      new Promise<void>((resolve) =>
        timers.setTimeout(() => {
          resolve();
        }, 100)
      );
    e.on('a', listener);
    e.emit('a', 1);
    await e.wait();
    assert.strict.ok(
      customConsole.error.calledOnce &&
        customConsole.error.calledWithMatch(
          /event listener took more than %d ms to be resolved/
        )
    );
  }
);

suite.test('it should flush just specific event names', () => {
  const e = new EventEmitter<{
    a: number;
    b: string;
  }>();
  e.emit('a', 1);
  e.emit('b', '...');
  e.on('a', () => {});
});

suite.test('it should handle listeners that return promises', async () => {
  let n = 0;
  interface Events {
    setValue: {
      expectedValue: number;
      newValue: number;
    };
  }
  const e = new EventEmitter<Events>();
  e.on('setValue', async ({ expectedValue, newValue }) => {
    assert.strict.equal(expectedValue, n);
    n = newValue;
    await wait(10);
  });
  for (let i = 0; i < 10; i++) {
    e.emit('setValue', {
      expectedValue: i,
      newValue: i + 1,
    });
  }
  await e.wait();
});

suite.test(
  'it should handle cases where the options do not want us to wait for listeners',
  () => {
    const e = new EventEmitter<{
      a: number;
    }>({
      waitListenerPromise: false,
    });
    e.on('a', () => wait(10));
    e.on('a', () => wait(10));
    e.on('a', () => wait(10));
    e.on('a', () => wait(10));
    e.emit('a', 1);
  }
);

suite.test(
  'it should log if wait is called when event emitter is in paused state',
  async () => {
    const customConsole = {
      log: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy(),
    };
    const logger = new Logger([], {
      console: customConsole,
      root: null,
    });
    const e = new EventEmitter<{ a: number }>({
      logger,
    });
    e.pause();
    await e.wait();
    assert.strict.ok(
      customConsole.error.calledOnceWithExactly(
        'EventEmitter: wait called used in a weird manner. event emitter is stopped'
      )
    );
  }
);

export default suite;
