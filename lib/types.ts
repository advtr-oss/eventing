export enum STATE {
  CLOSED = 'closed',
  CLOSING= 'closing',
  OPENING = 'opening',
  OPEN = 'open'
}

export interface QueueOptions {
  //
  arguments?: object
  //
  expires?: number
  //
  messageTtl?: number
  //
  deadLetterExchange?: string
  //
  deadLetterRoutingKey?: string
  //
  maxLength?: number
  //
  maxPriority?: number
  //
  overflow?: any
  //
  queueMode?: string
  //
  durable?: boolean
  //
  autoDelete?: boolean
}

export interface ConsumeOptions {
  //
  arguments?: ConsumeOptions
  //
  consumerTag?: string
  //
  noLocal?: Boolean
  //
  noAck: Boolean
  //
  exclusive?: Boolean
}
