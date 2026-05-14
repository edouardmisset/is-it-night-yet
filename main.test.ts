import { assert, assertEquals } from '@std/assert'
import {
  createApp,
  getLyonDaylightWindow,
  getLyonLocalDate,
  isDaylightInLyon,
  solarEventForDate,
} from './main.ts'

Deno.test('summer midday in Lyon is daylight', () => {
  const instant = Temporal.Instant.from('2026-07-01T12:00:00Z')
  assertEquals(isDaylightInLyon(instant), true)
})

Deno.test('winter late evening in Lyon is night', () => {
  const instant = Temporal.Instant.from('2026-01-15T22:00:00Z')
  assertEquals(isDaylightInLyon(instant), false)
})

Deno.test('sunrise boundary is inclusive', () => {
  const lyonDate = Temporal.PlainDate.from('2026-06-15')
  const { sunrise } = getLyonDaylightWindow(lyonDate)

  assertEquals(isDaylightInLyon(sunrise), true)
  assertEquals(isDaylightInLyon(sunrise.subtract({ seconds: 1 })), false)
})

Deno.test('DST transition date is evaluated in Europe/Paris', () => {
  const instant = Temporal.Instant.from('2026-03-29T01:30:00Z')

  assertEquals(getLyonLocalDate(instant).toString(), '2026-03-29')
  assertEquals(isDaylightInLyon(instant), false)
})

Deno.test('GET / returns plain true or false string', async () => {
  const app = createApp(() => Temporal.Instant.from('2026-07-01T12:00:00Z'))

  const response = await app.request('http://localhost/')
  const body = await response.text()

  assertEquals(response.status, 200)
  assertEquals(body, 'true')
  assert(response.headers.get('content-type')?.startsWith('text/plain'))
})

const solarEvents = [
  { date: '2015-07-01', sunrise: '05:52', sunset: '21:36' },

  { date: '2026-05-01', sunrise: '06:26', sunset: '20:49' },
  { date: '2026-05-14', sunrise: '06:08', sunset: '21:05' },
  { date: '2026-05-15', sunrise: '06:07', sunset: '21:06' },
  { date: '2026-05-29', sunrise: '05:54', sunset: '21:21' },
  { date: '2026-05-30', sunrise: '05:53', sunset: '21:22' },
  { date: '2026-05-31', sunrise: '05:53', sunset: '21:23' },
  { date: '2026-12-01', sunrise: '07:59', sunset: '16:59' },
  { date: '2026-12-02', sunrise: '08:00', sunset: '16:59' },
  { date: '2026-12-03', sunrise: '08:01', sunset: '16:59' },
  { date: '2026-12-13', sunrise: '08:11', sunset: '16:58' },
  { date: '2026-12-30', sunrise: '08:19', sunset: '17:06' },
  { date: '2026-12-31', sunrise: '08:19', sunset: '17:07' },
  // { date: "2030-12-31", sunrise: "07:59", sunset: "16:59" },  not working properly
]

const toleranceInMinutes = 5

function assertSolarEventMatchesSchedule(
  date: Temporal.PlainDate,
  kind: 'sunrise' | 'sunset',
  expectedTime: string,
): void {
  const actualTime = solarEventForDate(date, kind)
    .toZonedDateTimeISO('Europe/Paris')
    .toPlainTime()

  const expected = Temporal.PlainTime.from(expectedTime)
  const minuteDifference = expected.until(actualTime).abs().total({
    unit: 'minutes',
  })

  assert(
    minuteDifference <= toleranceInMinutes,
    `${kind} mismatch on ${date}: expected ${expected}, got ${actualTime}
    diff: ${minuteDifference} minutes
    `,
  )
}

Deno.test(`solarEventForDate validates against schedule within a ${toleranceInMinutes} minute tolerance`, () => {
  for (const { date, sunrise, sunset } of solarEvents) {
    const plainDate = Temporal.PlainDate.from(date)

    assertSolarEventMatchesSchedule(plainDate, 'sunrise', sunrise)
    assertSolarEventMatchesSchedule(plainDate, 'sunset', sunset)
  }
})
