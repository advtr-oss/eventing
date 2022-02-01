import { BaseQueue } from '../base-queue'
import { ConsumeOptions } from '../types'
import { ExecuteWhenOpen, AMQPQueue, AMQPChannel } from '../symbols'
import { Context, createContext, AMQPMessage } from '../context'
import { verbose, notice } from '../proc-log'

export class Queue extends BaseQueue {
  publish (...args: any[]) {
    for (const arg of args) {
      this.$__publish(JSON.stringify(arg))
    }
  }

  private $__publish (message: string) {
    this[ExecuteWhenOpen]().then(function (this: Queue) {
      verbose(`eventing:queue:${this[AMQPQueue].queue}`, { queue: this[AMQPQueue].queue }, 'Sent %s', message)
      this[AMQPChannel].sendToQueue(this[AMQPQueue].queue, Buffer.from(message))
    }.bind(this)).catch(err => this.emit('error', err))
  }

  subscribe<Packet = any>(listener: (context: Context<Packet>) => void, opts?: ConsumeOptions) {
    const options: ConsumeOptions = { noAck: true, ...opts }
    this[ExecuteWhenOpen]().then(function (this: Queue) {
      notice(`eventing:queue:${this[AMQPQueue].queue}`, { queue: this[AMQPQueue].queue }, 'Listening to events')
      this[AMQPChannel].consume(this[AMQPQueue].queue, function (this: Queue, message: AMQPMessage) {
        return listener(createContext({ queue: this, message }))
      }.bind(this), options)
    }.bind(this)).catch(err => this.emit('error', err))
  }
}
