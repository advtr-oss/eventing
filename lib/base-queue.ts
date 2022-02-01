import { EventEmitter } from 'events'

import { Abort, AMQPChannel, AMQPConnection, AMQPQueue, ExecuteWhenOpen } from './symbols'
import { StreamManager } from './stream'
import { QueueOptions, ConsumeOptions, STATE } from './types'
import { verbose, warn } from './proc-log'
import { Context, createContext } from './context'
import { constructor } from './utils/static'

const abortControllerMap = new WeakMap<BaseQueue, AbortController>([])

type QueueCallback = (error: Error | null, queue?: BaseQueue) => void

export class BaseQueue extends EventEmitter {
  static type: string = 'queue'

  public readonly name: String

  public readonly options: QueueOptions

  protected [AMQPQueue]: any

  protected [AMQPChannel]: any

  protected $__state: STATE

  private readonly manager: StreamManager

  private readonly $__buffer: Function[]

  private readonly $__initialPromise: Promise<BaseQueue>

  /**
   * The callback is used mainly for testing, and if the end user want's to be fully promise based
   * */
  constructor (manager: StreamManager, name: string)
  constructor (manager: StreamManager, name: string, options: QueueOptions)
  constructor (manager: StreamManager, name: string, callback: QueueCallback)
  constructor (manager: StreamManager, name: string, options: QueueOptions, callback: QueueCallback)
  constructor (manager: StreamManager, name: string, optionsOrCallback?: QueueOptions | QueueCallback, callback?: QueueCallback) {
    super()

    this.name = name
    this.manager = manager

    let opts: QueueOptions = { }
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback
    } else if (optionsOrCallback != null) {
      opts = optionsOrCallback
    }

    this.options = opts

    this.$__state = STATE.OPENING

    abortControllerMap.set(this, new AbortController())

    const promise: Promise<BaseQueue> = this.manager[ExecuteWhenOpen]()
      .then(async () => await this.connect(name, opts)).then(() => this)
    this.$__initialPromise = promise

    this.$__buffer = []
    promise.then((queue) => {
      (callback != null) && callback(null, queue)
      return queue
    }).then((queue) => {
      // @ts-expect-error
      verbose(`eventing:${constructor(queue).type}`, { name }, 'Queued created %s', name)
      // @ts-expect-error
      verbose(`eventing:${constructor(queue).type}`, { count: queue.$__buffer.length }, 'emptying queries queue (%s to go)', queue.$__buffer.length)

      // We can't abort it now
      abortControllerMap.delete(queue)

      queue.$__buffer.forEach((cb) => {
        cb(queue)
      })
    }).catch((err) => {
      abortControllerMap.delete(this)
      ;(callback != null) && callback(err)
    })
  }

  /**
   * Did want to use a custom then/catch but this will
   * never work with the
   * */
  async asPromise (): Promise<BaseQueue> {
    return await this.$__initialPromise
  }

  /**
   * Set the prefetch value
   * */
  prefetch (count: number): void {
    this[ExecuteWhenOpen]().then(function (queue) {
      queue[AMQPChannel].prefetch(count)
    }).catch(error => this.emit('error', error))
  }

  /**
   * Publish events onto the stream queue
   * */
  publish (...args: any[]) {
    throw new Error('Not Implemented - Please subclass and use those instead')
  }

  /**
   * Subscribe to the events on the queue
   * */
  subscribe<Packet = any>(listener: (context: Context<Packet>) => void, opts?: ConsumeOptions) {
    throw new Error('Not Implemented - Please subclass and use those instead')
  }

  private async connect (name: string, options: QueueOptions): Promise<void> {
    // Assume this is not optional since connect should only be called by the constructor
    const { signal } = abortControllerMap.get(this)!

    if (signal.aborted) {
      return Promise.reject(new Error('Aborted connection due to error'))
    }

    // Standard abortion in promise
    const abort = (reject: (reason?: any) => void) => () =>
      reject(new Error('Aborted connection due to error'))

    // Standard rejection code
    const rejection = (reject: (reason?: any) => void) => (error?: Error | unknown) => {
      this.$__state = STATE.CLOSED
      this.emit('error:opening', error)

      signal.removeEventListener('abort', abort(reject))
      return reject(error)
    }

    return await new Promise<void>(async function (this: BaseQueue, resolve, reject) {
      // @ts-expect-error
      verbose(`eventing:${constructor(this).type}`, { name, ...options }, 'Attempting to create queue %s', name)

      signal.addEventListener('abort', abort(reject))

      try {
        this[AMQPChannel] = await this.manager[AMQPConnection].createChannel()

        // This is needed for some reason, even though the errors are handled
        // by the promises, and we get the result I need, it throws an unhandled
        // error exception
        this[AMQPChannel].once('error', rejection(reject))

        // Assert the queue, this is where most things could fail w/ options
        this[AMQPQueue] = await this[AMQPChannel].assertQueue(name, options)

        this.$__state = STATE.OPEN
        this.emit('open', this)

        ;['error', 'close', 'return', 'drain'].forEach(function (this: BaseQueue, eventName) {
          this[AMQPChannel].on(eventName, (...args) => this.emit(eventName, ...args))
        }.bind(this))

        signal.removeEventListener('abort', abort(reject))
        return resolve()
      } catch (err) {
        return rejection(reject)(err)
      }
    }.bind(this))
  }

  // Abort the connection
  [Abort] () {
    // @ts-expect-error
    warn(`eventing:${constructor(this).type}`, { state: this.$__state }, 'Abort called')

    const controller = abortControllerMap.get(this)
    ;(controller != null) && controller.abort()
  }

  // static type: string = 'queue'
  //
  // public name: string
  //
  // protected $__options: QueueOptions
  //
  // protected $__state: STATE
  //
  // protected [AMQPChannel]: any
  //
  // protected [AMQPQueue]: any
  //
  // private readonly manager: StreamManager
  //
  // private readonly buffer: Function[]
  //
  // constructor (stream: StreamManager, name: string, options?: QueueOptions) {
  //   super()
  //
  //   this.name = name
  //   this.manager = stream
  //
  //   this.$__state = STATE.OPENING
  //   this.$__options = options || { }
  //
  //   // This is a more internal thing, it will just flush the queue
  //   this.buffer = []
  //   this.on('open', function (this: BaseQueue, queue: BaseQueue) {
  //     // @ts-expect-error
  //     verbose(`eventing:${this.constructor.type}`, { queue }, 'channel has been opened')
  //     // @ts-expect-error
  //     verbose(`eventing:${this.constructor.type}`, { queue }, 'emptying queries queue (%s to go)', this.buffer.length)
  //
  //     this.buffer.forEach((cb) => {
  //       cb(queue)
  //     })
  //   }.bind(this))
  //
  //   // Only connect to the queue when the connection is open
  //   this.manager[ExecuteWhenOpen]().then(function (this: BaseQueue) {
  //     this.connect(name, options)
  //   }.bind(this)).catch(function (this: BaseQueue, error) { this.emit('error:opening', error) }.bind(this))
  // }
  //
  // protected connect (name, options) {
  //   this.manager[AMQPConnection].createChannel(function (this: BaseQueue, error?: Error, channel?: any) {
  //     // Handle this up the stream
  //     //
  //     // This is covered by the coverage somehow, not sure where or how
  //     if (error != null) {
  //       this.$__state = STATE.CLOSED
  //       return this.emit('error:opening', error)
  //     }
  //
  //     this[AMQPChannel] = channel
  //
  //     // Assert the queue
  //     this[AMQPChannel].assertQueue(name, options, function (this: BaseQueue, error?: Error, queue?: any) {
  //       if (error != null) {
  //         this.$__state = STATE.CLOSED
  //         return this.emit('error:opening', error)
  //       }
  //
  //       this[AMQPQueue] = queue
  //
  //       this.$__state = STATE.OPEN
  //       this.emit('open', this)
  //     }.bind(this))
  //   }.bind(this))
  // }
  //
  // /**
  //  * Set the prefetch value
  //  * */
  // prefetch (count: number): void {
  //   this[ExecuteWhenOpen]().then(function (queue) {
  //     queue[AMQPChannel].prefetch(count)
  //   })
  // }
  //
  // /**
  //  * Publish events onto the stream queue
  //  * */
  // publish (...args: any[]) {
  //   throw new Error('Not Implemented - Please subclass and use those instead')
  // }
  //
  // /**
  //  * Subscribe to the events on the queue
  //  * */
  // subscribe<Packet = any>(listener: (context: Context<Packet>) => void, opts?: ConsumeOptions) {
  //   throw new Error('Not Implemented - Please subclass and use those instead')
  // }
  //
  /**
   * Allow all methods to be queued up, this allows for seamless async work without
   * waiting for connections, the functions that are directionally will wait, the rest
   * can go about their business like so
   * */
  async [ExecuteWhenOpen] (): Promise<BaseQueue> {
    switch (this.$__state) {
      case STATE.OPEN:
        return this
      case STATE.OPENING:
        return await new Promise(function (this: BaseQueue, resolve) {
          this.$__buffer.push(resolve)
        }.bind(this))
      case STATE.CLOSED:
      case STATE.CLOSING:
      default:
        throw new Error('Cannot execute value with closed stream')
    }
  }
}

// const queue = new BaseQueue()
