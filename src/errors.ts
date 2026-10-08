import { randomUUID } from 'node:crypto'
import type { Schemas } from './types.ts'

export function serverInfo() {
  const now = new Date()
  const pad = (num: number) => String(num).padStart(2, '0')
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `Live-System (Version 1.5-74, Serverzeit ${time}, 1 active users)`
}

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

export function gnNotFound(message: string): Schemas['GnError'] {
  return gnError(
    'com.proximity.gp.common.exception.ResourceNotFoundException',
    message
  )
}

export function gnValidationFailed(
  message: string,
  validationErrors: Schemas['GnValidationError'][] | null = null
): Schemas['GnError'] {
  return gnError(
    'com.proximity.gp.common.exception.ValidationException',
    message,
    validationErrors
  )
}

export function gnServerError(message: string): Schemas['GnError'] {
  return gnError('java.lang.RuntimeException', message)
}

function gnError(
  exceptionClassName: string,
  message: string,
  validationErrors: Schemas['GnValidationError'][] | null = null
): Schemas['GnError'] {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    exceptionClassName,
    message,
    validationErrors,
  }
}

export class InvalidRequest extends Error {
  validationErrors: Schemas['GnValidationError'][]
  missingBody: boolean

  constructor(
    message: string,
    validationErrors: Schemas['GnValidationError'][] = [],
    missingBody = false
  ) {
    super(message)
    this.validationErrors = validationErrors
    this.missingBody = missingBody
  }
}
