import { SLOT_STEP, OCCUPIED_STATUSES } from "./config.js";
import {
  validDate,
  validTime,
  weekday,
  minutes,
  toTime,
  timestamp,
} from "./utils.js";
export const overlaps = (a, b, c, d) => a < d && b > c;
export function workingWindows(barber, date) {
  if (
    !barber?.active ||
    !validDate(date) ||
    !barber.schedule.days.includes(weekday(date))
  )
    return [];
  if (barber.vacations.some((v) => date >= v.start && date <= v.end)) return [];
  const s = barber.schedule,
    start = minutes(s.start),
    end = minutes(s.end);
  return s.lunchStart && s.lunchEnd
    ? [
        [start, minutes(s.lunchStart)],
        [minutes(s.lunchEnd), end],
      ]
    : [[start, end]];
}
export function availabilityError(
  state,
  booking,
  { now = Date.now(), excludeId = booking.id } = {},
) {
  const service = state.services.find((s) => s.id === booking.serviceId);
  const barber = state.barbers.find((b) => b.id === booking.barberId);
  if (!service?.active) return "Selecione um serviço ativo.";
  if (!barber?.active) return "Selecione um profissional ativo.";
  if (!validDate(booking.date) || !validTime(booking.time))
    return "Informe data e horário válidos.";
  if (timestamp(booking.date, booking.time) <= now)
    return "Escolha um horário futuro (horário de Brasília).";
  const start = minutes(booking.time),
    end =
      start +
      (booking.duration ?? service.duration) +
      (booking.buffer ?? service.buffer);
  if (
    !workingWindows(barber, booking.date).some(
      ([a, b]) => start >= a && end <= b,
    )
  )
    return "Horário fora do expediente, em intervalo, folga ou férias.";
  if (
    barber.blocks.some(
      (b) =>
        b.date === booking.date &&
        overlaps(start, end, minutes(b.start), minutes(b.end)),
    )
  )
    return "Horário bloqueado pelo profissional.";
  if (
    state.bookings.some(
      (b) =>
        b.id !== excludeId &&
        b.date === booking.date &&
        b.barberId === barber.id &&
        OCCUPIED_STATUSES.includes(b.status) &&
        overlaps(
          start,
          end,
          minutes(b.time),
          minutes(b.time) + b.duration + b.buffer,
        ),
    )
  )
    return "Este horário já está ocupado. Escolha outro.";
  return "";
}
export function availableSlots(
  state,
  { serviceId, barberId, date, excludeId = null },
  now = Date.now(),
) {
  const barber = state.barbers.find((b) => b.id === barberId);
  return workingWindows(barber, date).flatMap(([start, end]) => {
    const list = [];
    for (let t = start; t < end; t += SLOT_STEP) {
      const time = toTime(t);
      if (
        !availabilityError(
          state,
          { serviceId, barberId, date, time },
          { now, excludeId },
        )
      )
        list.push(time);
    }
    return list;
  });
}
export function occupiedMinutes(state, barber, date) {
  // Union intersections avoids over-counting blocks and old conflicting bookings.
  const intervals = [
    ...barber.blocks
      .filter((b) => b.date === date)
      .map((b) => [minutes(b.start), minutes(b.end)]),
    ...state.bookings
      .filter(
        (b) =>
          b.date === date &&
          b.barberId === barber.id &&
          OCCUPIED_STATUSES.includes(b.status),
      )
      .map((b) => [minutes(b.time), minutes(b.time) + b.duration + b.buffer]),
  ];
  let occupied = 0,
    capacity = 0;
  for (const [a, b] of workingWindows(barber, date)) {
    capacity += b - a;
    let last = a;
    for (const [c, d] of intervals
      .map(([c, d]) => [Math.max(a, c), Math.min(b, d)])
      .filter(([c, d]) => c < d)
      .sort((x, y) => x[0] - y[0])) {
      occupied += Math.max(0, d - Math.max(last, c));
      last = Math.max(last, d);
    }
  }
  return { occupied, capacity };
}
