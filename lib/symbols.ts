export const AMQPConnection = Symbol('eventing:stream:amqp')

export const AMQPChannel = Symbol('eventing:queue:channel')

export const AMQPQueue = Symbol('eventing:queue:queue')

// Allow for only us to use this as an internal method
export const ExecuteWhenOpen = Symbol('eventing:executeWhenOpen')

export const ContextQueue = Symbol('context:queue')

export const Abort = Symbol('eventing:abort')
