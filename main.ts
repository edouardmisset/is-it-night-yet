import { Hono } from 'hono'

const LYON = {
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: 'Europe/Paris',
} as const

const APPARENT_ZENITH_DEGREES = 90.833
const MS_PER_DAY = 86_400_000
const MS_PER_HOUR = 3_600_000

type SunEvent = 'sunrise' | 'sunset'
type InstantProvider = () => Temporal.Instant

function degToRad(value: number): number {
  return value * (Math.PI / 180)
}

function radToDeg(value: number): number {
  return value * (180 / Math.PI)
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360
  return normalized >= 0 ? normalized : normalized + 360
}

function splitMsOfDay(msOfDay: number): {
  hour: number
  minute: number
  second: number
  millisecond: number
} {
  const hour = Math.floor(msOfDay / MS_PER_HOUR)
  const minute = Math.floor((msOfDay % MS_PER_HOUR) / 60_000)
  const second = Math.floor((msOfDay % 60_000) / 1_000)
  const millisecond = msOfDay % 1_000

  return { hour, minute, second, millisecond }
}

export function solarEventForDate(
  date: Temporal.PlainDate,
  event: SunEvent,
): Temporal.Instant {
  const lngHour = LYON.longitude / 15
  const approximateTime = date.dayOfYear +
    ((event === 'sunrise' ? 6 : 18) - lngHour) / 24

  const meanAnomaly = (0.9856 * approximateTime) - 3.289
  const trueLongitude = normalizeDegrees(
    meanAnomaly +
      (1.916 * Math.sin(degToRad(meanAnomaly))) +
      (0.02 * Math.sin(degToRad(2 * meanAnomaly))) +
      282.634,
  )

  let rightAscension = radToDeg(
    Math.atan(0.91764 * Math.tan(degToRad(trueLongitude))),
  )
  rightAscension = normalizeDegrees(rightAscension)

  const lQuadrant = Math.floor(trueLongitude / 90) * 90
  const raQuadrant = Math.floor(rightAscension / 90) * 90
  rightAscension += lQuadrant - raQuadrant
  rightAscension /= 15

  const sinDec = 0.39782 * Math.sin(degToRad(trueLongitude))
  const cosDec = Math.cos(Math.asin(sinDec))

  const cosLocalHourAngle = (Math.cos(degToRad(APPARENT_ZENITH_DEGREES)) -
    (sinDec * Math.sin(degToRad(LYON.latitude)))) /
    (cosDec * Math.cos(degToRad(LYON.latitude)))

  if (cosLocalHourAngle > 1 || cosLocalHourAngle < -1) {
    throw new RangeError('Sun event does not exist for the provided date.')
  }

  let localHourAngle = radToDeg(Math.acos(cosLocalHourAngle))
  if (event === 'sunrise') {
    localHourAngle = 360 - localHourAngle
  }
  localHourAngle /= 15

  const localMeanTime = localHourAngle + rightAscension -
    (0.06571 * approximateTime) - 6.622

  // Convert computed universal time to a UTC instant on the same date.
  const utcHours = localMeanTime - lngHour
  const normalizedUtcHours = ((utcHours % 24) + 24) % 24
  const totalMs = Math.round(normalizedUtcHours * MS_PER_HOUR)
  const msOfDay = ((totalMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY
  const time = splitMsOfDay(msOfDay)

  return Temporal.ZonedDateTime.from({
    timeZone: 'UTC',
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time.hour,
    minute: time.minute,
    second: time.second,
    millisecond: time.millisecond,
  }).toInstant()
}

export function getLyonLocalDate(
  instant: Temporal.Instant,
): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(LYON.timeZone).toPlainDate()
}

export function getLyonDaylightWindow(date: Temporal.PlainDate): {
  sunrise: Temporal.Instant
  sunset: Temporal.Instant
} {
  return {
    sunrise: solarEventForDate(date, 'sunrise'),
    sunset: solarEventForDate(date, 'sunset'),
  }
}

export function isDaylightInLyon(instant: Temporal.Instant): boolean {
  const lyonDate = getLyonLocalDate(instant)
  const { sunrise, sunset } = getLyonDaylightWindow(lyonDate)

  return Temporal.Instant.compare(instant, sunrise) >= 0 &&
    Temporal.Instant.compare(instant, sunset) < 0
}

export function createApp(
  now: InstantProvider = () => Temporal.Now.instant(),
): Hono {
  const app = new Hono()

  app.get('/', (c) => {
    const value = isDaylightInLyon(now()) ? 'true' : 'false'
    return c.text(value)
  })

  return app
}

const app = createApp()

if (import.meta.main) {
  Deno.serve({ port: 8787 }, app.fetch)
}

export { app }
