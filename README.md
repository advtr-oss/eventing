# @advtr/eventing

> This is a simple wrapper around [`amqp-node/amqplib`](https://github.com/amqp-node/amqplib)

## Principles

- Keep the code upto date with [`amqp-node/amqplib`](https://github.com/amqp-node/amqplib)
- TDD with a high coverage rate
- Asynchronous synchronicity syntax, where possible
- Built in `Typescript` support, too many options for `jsdoc` to handle and work with Intellisense comfortably
- Trying to not cry

## Example API

The ideal API syntax will be attuned with the way [`Automattic/monk`](https://github.com/Automattic/monk) works.
With the forefront on asynchronous synchronicity, meaning since we're basically a giant `EventEmitter` we don't need
to block the main process, we can queue up processes and run them once the manager has connected to RabbitMQ

```typescript
import createManager from './lib/index'

const todos = []

// Create the manager
const manager: StreamManager = createManager('amqp://localhost', (err) => {		
  // Exit if their is an connection error
  if (err) process.exit(1)
})

// Create the new queue
const queue = manager.create<Queue>('tasks', { noAck: false })

// Subscribe to the events of the stream
queue.subscribe<string>(context => {
  todos.push(context.packet)
  
  // Acknowledge the packet has been delt with
  context.ack()
})
```
