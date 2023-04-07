# eventual-js

## Installation

```
yarn add eventual-js
```

## Usage

```ts
const e = new EventEmitter<{ a: number }>();
e.on('a', (n) => console.log('received event: %d', n));
e.emit('a', 1);
e.emit('a', 2);
e.emit('a', 3);
e.emit('a', 4);
```
