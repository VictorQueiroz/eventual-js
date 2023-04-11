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
}

export default class EventEmitter<EventMap extends Record<string, unknown>> {
  readonly #queueIfNoEventListeners;
  readonly #maxListenerWaitTime;
  readonly #waitListenerPromise;
  readonly #events = new Map<keyof EventMap, IEvent>();
  public constructor({
    waitListenerPromise = true,
    queueIfNoEventListeners = true,
    maxListenerWaitTime = 5000,
  }: Partial<IEventEmitterOptions> = {}) {
    this.#waitListenerPromise = waitListenerPromise;
    this.#maxListenerWaitTime = maxListenerWaitTime;
    this.#queueIfNoEventListeners = queueIfNoEventListeners;
  }
  public async wait() {
    for (const e of this.#events) {
      await e[1].pending;
    }
  }
  public on<K extends keyof EventMap>(
    name: K,
    listener: (value: EventMap[K]) => void
  ) {
    const { listeners, pendingEventEmits } = this.#event(name);
    listeners.add(listener as EventCallback);

    for (const value of pendingEventEmits.splice(0, pendingEventEmits.length)) {
      this.emit(name, value as EventMap[K]);
    }
  }
  public off<K extends keyof EventMap>(
    name: K,
    listener: (value: EventMap[K]) => void
  ) {
    this.#event(name).listeners.delete(listener as EventCallback);
  }
  public emit<K extends keyof EventMap>(name: K, value: EventMap[K]) {
    const e = this.#event(name);
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
        this.#callEventListener(l, value);
        continue;
      }
      e.pending = Promise.resolve(e.pending).then(
        () =>
          new Promise<void>((resolve) => {
            const timeoutId = setTimeout(() => {
              console.error(
                'event listener took more than %d ms to be resolved: %o',
                this.#maxListenerWaitTime,
                l
              );
              resolve();
            }, this.#maxListenerWaitTime);
            this.#callEventListener(l, value)
              .then(() => {})
              .finally(() => {
                clearTimeout(timeoutId);
                resolve();
              });
          })
      );
    }
  }
  async #callEventListener<T>(listener: (value: T) => void, value: T) {
    let result: unknown;
    try {
      result = listener(value);
    } catch (reason) {
      console.error('event listener returned threw an exception: %o', reason);
      result = null;
    }
    return Promise.resolve(result).catch((reason) => {
      console.error(
        'event listener returned a promise that was rejected with error: %o',
        reason
      );
    });
  }
  #event(name: keyof EventMap) {
    let e = this.#events.get(name);
    if (!e) {
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
