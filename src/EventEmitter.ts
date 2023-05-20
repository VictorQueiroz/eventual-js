import { ILogger } from '@jscriptlogger/lib';

type EventCallback =
  | ((value: unknown) => void)
  | ((value: unknown) => Promise<void>);

interface IEvent<T = unknown> {
  listeners: Set<EventCallback>;
  pendingEventEmits: T[];
  pending: Promise<void> | null;
}

export interface IEventEmitterOptions {
  maxListenerWaitTime: number;
  waitListenerPromise: boolean;
  queueIfNoEventListeners: boolean;
  logger: ILogger;
}

enum EventEmitterState {
  Started,
  Stopped,
}

export default class EventEmitter<EventMap extends Record<string, any>> {
  readonly #queueIfNoEventListeners;
  readonly #maxListenerWaitTime;
  readonly #waitListenerPromise;
  readonly #events = new Map<keyof EventMap, IEvent>();
  readonly #logger;
  #state: EventEmitterState;
  public constructor({
    waitListenerPromise = true,
    queueIfNoEventListeners = true,
    logger,
    maxListenerWaitTime = 1000,
  }: Partial<IEventEmitterOptions> = {}) {
    this.#state = EventEmitterState.Started;
    this.#waitListenerPromise = waitListenerPromise;
    this.#maxListenerWaitTime = maxListenerWaitTime;
    this.#queueIfNoEventListeners = queueIfNoEventListeners;
    this.#logger = logger?.at('EventEmitter');
  }
  public async wait(eventNames: (keyof EventMap)[] = []) {
    if (this.#state !== EventEmitterState.Started) {
      this.#logger?.error(
        'wait called used in a weird manner. event emitter is stopped'
      );
      return;
    }
    this.#flushEvents(eventNames);
    for (const e of this.#events) {
      if (eventNames.length > 0 && !eventNames.includes(e[0])) {
        continue;
      }
      await e[1].pending;
    }
  }
  public on<K extends keyof EventMap>(
    name: K,
    listener: (value: EventMap[K]) => void
  ) {
    const { listeners } = this.#event(name);
    listeners.add(listener as EventCallback);

    this.#flushEvents([name]);
    return this;
  }
  public off<K extends keyof EventMap>(
    name: K,
    listener: (value: EventMap[K]) => void
  ) {
    this.#event(name).listeners.delete(listener as EventCallback);
  }
  public emit<K extends keyof EventMap>(name: K, value: EventMap[K]) {
    const e = this.#event(name);
    if (this.#state === EventEmitterState.Stopped) {
      e.pendingEventEmits.push(value);
      return;
    }
    if (this.#queueIfNoEventListeners) {
      if (!e.listeners.size) {
        e.pendingEventEmits.push(value);
        return;
      }
    }
    for (const l of e.listeners) {
      /**
       * in case waitListenerPromise is disabled do not wait
       * for the promise returned by the listener. only check for uncaught
       * failures
       */
      if (!this.#waitListenerPromise) {
        /**
         * pause event emitting
         */
        this.pause();
        const result = this.#callEventListener(l, value);
        e.pending = Promise.all([e.pending, result]).then(() => {});
        this.resume();
        this.#flushEvents([name]);
        continue;
      }
      e.pending = Promise.resolve(e.pending).then(
        () =>
          new Promise<void>((resolve) => {
            const resumeAndResolve = () => {
              this.resume();
              this.#flushEvents([name]);
              resolve();
            };
            const timeoutId = setTimeout(() => {
              this.#logger?.error(
                'event listener took more than %d ms to be resolved: %o',
                this.#maxListenerWaitTime,
                l
              );
              resumeAndResolve();
            }, this.#maxListenerWaitTime);
            this.pause();
            this.#callEventListener(l, value).finally(() => {
              clearTimeout(timeoutId);
              resumeAndResolve();
            });
          })
      );
    }
  }
  public pause() {
    if (this.#state !== EventEmitterState.Started) {
      this.#logger?.error(
        'pause called when event emitter was already stopped'
      );
      return;
    }
    this.#state = EventEmitterState.Stopped;
  }
  public resume() {
    if (this.#state !== EventEmitterState.Stopped) {
      this.#logger?.error(
        'resume was called, but event emitter was in stopped state'
      );
      return;
    }
    this.#state = EventEmitterState.Started;
  }
  #flushEvents(names: (keyof EventMap)[]) {
    for (const [name, e] of this.#events) {
      if (names.length > 0 && !names.includes(name)) {
        continue;
      }
      const pendingDispatches = e.pendingEventEmits.splice(
        0,
        e.pendingEventEmits.length
      );
      for (const value of pendingDispatches) {
        this.emit(name, value as EventMap[typeof name]);
      }
    }
  }
  async #callEventListener<T>(listener: (value: T) => void, value: T) {
    let result: unknown;
    try {
      result = listener(value);
    } catch (reason) {
      this.#logger?.error('event listener call threw an exception: %o', reason);
      result = null;
    }
    return Promise.resolve(result)
      .then(() => {})
      .catch((reason) => {
        this.#logger?.error(
          'event listener returned a promise that was rejected with error: %o',
          reason
        );
      });
  }
  #event(name: keyof EventMap): IEvent {
    let e = this.#events.get(name);
    if (typeof e === 'undefined') {
      e = {
        pendingEventEmits: new Array(),
        listeners: new Set(),
        pending: null,
      };
      this.#events.set(name, e);
    }
    return e;
  }
}
