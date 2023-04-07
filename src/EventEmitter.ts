type EventCallback = (value: unknown) => void;

interface IEvent<T = unknown> {
  listeners: Set<EventCallback>;
  pendingEventEmits: T[];
}

export interface IEventEmitterOptions {
  queueIfNoEventListeners: boolean;
}

export default class EventEmitter<EventMap extends Record<string, unknown>> {
  readonly #queueIfNoEventListeners;
  readonly #events = new Map<keyof EventMap, IEvent>();
  public constructor({
    queueIfNoEventListeners = true,
  }: Partial<IEventEmitterOptions> = {}) {
    this.#queueIfNoEventListeners = queueIfNoEventListeners;
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
      l(value);
    }
  }
  #event(name: keyof EventMap) {
    let e = this.#events.get(name);
    if (!e) {
      e = {
        pendingEventEmits: new Array(),
        listeners: new Set(),
      };
      this.#events.set(name, e);
    }
    return e;
  }
}
