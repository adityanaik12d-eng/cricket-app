export function oversToBalls(overs: number, ballsPerOver: number): number {
  const whole = Math.floor(overs)
  const fraction = Math.round((overs - whole) * ballsPerOver + 1e-9)
  return whole * ballsPerOver + fraction
}

export function ballsToOvers(balls: number, ballsPerOver: number): number {
  return Math.floor(balls / ballsPerOver) + (balls % ballsPerOver) / ballsPerOver
}

export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  const over = Math.floor(legalBalls / ballsPerOver)
  const ball = legalBalls % ballsPerOver
  return ball === 0 ? String(over) : `${over}.${ball}`
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}