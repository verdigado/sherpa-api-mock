import { randomUUID } from 'node:crypto'
import type { Schemas } from '../../types.ts'

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
