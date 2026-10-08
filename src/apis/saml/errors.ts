import { randomUUID } from 'node:crypto'
import type { Schemas } from '../../types.ts'
import { serverInfo } from '../server-info.ts'

export function samlError(
  status: number,
  message: string
): Schemas['SamlError'] {
  return {
    toType: 'ExceptionTO',
    exceptionClassName: 'com.proximity.gp.common.exception.ApiException',
    originalMessage: message,
    httpStatusCode: String(status),
    userMessage: message,
    serverInfo: serverInfo(),
    requestUuid: randomUUID(),
  }
}
