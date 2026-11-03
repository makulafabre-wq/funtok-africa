export const GROUP_LIVE_CAPACITY = 6;

export function availableLiveSeats(occupied: number[]) {
  return Array.from({ length: GROUP_LIVE_CAPACITY }, (_, i) => i + 1).filter((seat) => !occupied.includes(seat));
}