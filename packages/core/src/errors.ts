export type ValidationCode =
  | 'STATUS'
  | 'POSITION'
  | 'INNINGS_OVER'
  | 'WICKETS_LIMIT'
  | 'BOWLER_QUOTA'
  | 'CONSECUTIVE_OVERS'
  | 'BOWLER_IS_BATTER'
  | 'ILLEGAL_DISMISSAL'
  | 'WIDE_RUNS'
  | 'DUPLICATE_SEQ'
  | 'INVALID_FORMAT'
  | 'LINEUP_TOO_SHORT'
  | 'DUPLICATE_PLAYER'
  | 'QUOTA_UNCOVERABLE'
  | 'NO_TOSS'

export interface ValidationError {
  code: ValidationCode
  message: string
}

export type ValidationResult = { ok: true } | { ok: false; error: ValidationError }

export class EngineError extends Error {
  readonly code: ValidationCode

  constructor(code: ValidationCode, message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}