import { LogLevels } from '@harrytwright/logger'

const log = (level: LogLevels) => (namespace: string, context?: Object | string, ...rest: any[]) =>
// @ts-expect-error
  process.emit('log', level, namespace, context, ...rest)

export const info = log('info')

export const notice = log('notice')

export const verbose = log('verbose')

export const error = log('error')

export const warn = log('warn')

export const silly = log('silly')
