import { ContextQueue, AMQPQueue } from './symbols'
import { BaseQueue } from './base-queue'

export interface AMQPMessageFields {
  consumerTag: string
  deliveryTag: number
  redelivered: Boolean
  exchange: string
  routingKey: string
}

export interface AMQPMessageHeaders {
  contentType?: string
  contentEncoding?: string
  headers?: Object
  deliveryMode?: string
  priority?: string
  correlationId?: string
  replyTo?: string
  expiration?: any
  messageId?: string
  timestamp?: any
  type?: string
  userId?: string
  appId?: string
  clusterId?: string
}

export interface AMQPMessage {
  fields: AMQPMessageFields
  content: Buffer
  properties: AMQPMessageHeaders
}

export interface Context<Packet = any> extends AMQPMessageFields {
  readonly [ContextQueue]: BaseQueue
  publish: (...args: any[]) => void
  ack: () => void
  readonly packet: Packet
  headers: AMQPMessageHeaders
}

export function createContext<Packet = any> (opts: { queue: BaseQueue, message: AMQPMessage }): Context<Packet> {
  const { queue, message } = opts

  return {
    ...message.fields,
    [ContextQueue]: queue,
    publish: (...args: any[]) => queue.publish(...args),
    ack: () => queue[AMQPQueue].ack(message),
    headers: message.properties,
    packet: JSON.parse(message.content.toString())
  }
}
