import { EventEmitter } from 'events'

import { connect } from 'amqplib'

import { AMQPConnection, ExecuteWhenOpen } from './symbols'
import { BaseQueue } from './base-queue'
import { Queue } from './queues/queue'
import { error, verbose, warn } from './proc-log'
import { QueueOptions, STATE } from './types'
import { emitAlreadyClosed } from './utils/warning'

export interface CreateQueueOptions extends QueueOptions {
  type?: 'queue' | 'exchange'
}

export class StreamManager extends EventEmitter {
  // The raw AMQPConnection
  protected [AMQPConnection]: any

  // The connection URI
  protected $__connectionURI: string

  // The connection state
  protected $__state: STATE

  // Hidden buffer for any functions to be called before connected
  private readonly $__buffer: Function[]

  // The queue group for each stream manager
  private readonly $__queues: Map<String, BaseQueue>

  private readonly $__initialPromise: Promise<StreamManager>

  constructor (uri: string, callback?: (error: Error | null, manager?: StreamManager) => void) {
    super()

    this.$__queues = new Map<String, BaseQueue>([])
    this.$__state = STATE.OPENING
    this.$__connectionURI = uri

    const promise: Promise<StreamManager> = this.connect(uri).then(() => this)
    this.$__initialPromise = promise

    this.$__buffer = []
    promise.then((manager) => {
      (callback != null) && callback(null, manager)
      return manager
    }).then((manager) => {
      verbose('eventing:stream', { uri: manager.$__connectionURI }, 'connection opened')
      verbose('eventing:stream', { count: manager.$__buffer.length }, 'emptying queries queue (%s to go)', manager.$__buffer.length)

      manager.$__buffer.forEach((cb) => {
        cb(manager)
      })
    }).catch((err) => (callback != null) && callback(err))
  }

  /**
   * Did want to use a custom then/catch but this will
   * never work with the
   * */
  async asPromise (): Promise<StreamManager> {
    return await this.$__initialPromise
  }

  /**
	 * Connecting to the Stream
	 * */
  private async connect (uri: string): Promise<void> {
    verbose('eventing:stream', { uri }, 'Attempting connection to %s', uri)

    try {
      this[AMQPConnection] = await connect(uri)
      this.$__state = STATE.OPEN

      const self = this
      ;['error', 'blocked', 'unblocked'].forEach((event) => {
        self[AMQPConnection].on(event, (...args) => {
          self.emit(event, ...args)
        })
      })

      self[AMQPConnection].on('close', function (this: StreamManager, ...args) {
        switch (this.$__state) {
          case STATE.CLOSED:
          case STATE.CLOSING: {
            // TODO: Add better management here for closing of queues or something here
            warn('eventing:stream', { uri }, 'Closed called by connection', ...args)
            this.$__state = STATE.CLOSED
          }
        }
      }.bind(this))

      this.emit('open', this)
    } catch (err) {
      this.$__state = STATE.CLOSED
      this.emit('error:opening', err)
      throw err
    }
  }

  create(name: string, options?: CreateQueueOptions): BaseQueue {
    const opts: CreateQueueOptions = { type: 'queue', ...options }
    const constructor: typeof BaseQueue = opts.type === 'queue' ? Queue : BaseQueue

    if (!this.$__queues.has(name)) {
      this.$__queues.set(name, new constructor(this, name, sanitiseOptions(opts)))
    }

    return this.$__queues.get(name)!
  }

  register(queue: BaseQueue) {
    if (this.$__queues.has(queue.name) || queue["manager"] !== this) throw new Error('Cannot register already registered queue')
    this.$__queues.set(queue.name, queue)
  }

  /**
	 * Quit the connection
	 *
	 * @param {string|string} [reason] - The reason for the disconnect. This is used for logging only
   * @param {boolean} [force] - Force the close, not waiting for the emitted closing
	 * */
  async quit (reason?: string | boolean, force?: boolean): Promise<void> {
    if (typeof reason === 'boolean') {
      force = reason; reason = undefined
    }

    if (this.$__state === STATE.CLOSED || this.$__state === STATE.CLOSING) {
      emitAlreadyClosed()
      return await Promise.resolve()
    }

    async function close (this: StreamManager): Promise<void> {
      warn('eventing:stream', createLogContext({ uri: this.$__connectionURI, reason }), reason || 'Closing down')

      this.$__state = STATE.CLOSING

      try {
        await this[AMQPConnection].close()
      } catch (err) {
        process.emitWarning(err as Error)
      }

      this.$__state = STATE.CLOSED

      /**
       * Close the queues, might make this a separate method since we use it twice
       * */

      if (force) {
        return await new Promise<void>(function (this: StreamManager, resolve) {
          this.once('close', resolve)
        }.bind(this))
      }
    }

    // Catch the error here, this will mainly be for `ExecuteWhenOpen`
    return await this[ExecuteWhenOpen]().then(close.bind(this)).catch((err) => {
      warn('eventing:stream:close', err)
    })
  }

  /**
	 * Allow all methods to be queued up, this allows for seamless async work without
	 * waiting for connections, the functions that are directionally will wait, the rest
	 * can go about their business like so
	 * */
  async [ExecuteWhenOpen] (): Promise<StreamManager> {
    switch (this.$__state) {
      case STATE.OPEN:
        return this
      case STATE.OPENING:
        return await new Promise(function (this: StreamManager, resolve) {
          this.$__buffer.push(resolve)
        }.bind(this))
      case STATE.CLOSED:
      case STATE.CLOSING:
      default:
        throw new Error('Cannot execute value with closed stream')
    }
  }
}

function sanitiseOptions (opts: CreateQueueOptions): CreateQueueOptions {
  const shallow = { ...opts }
  if ('type' in shallow) delete shallow.type
  return shallow
}

function createLogContext (obj: Object): Object {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null))
}
