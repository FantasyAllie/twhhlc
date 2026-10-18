export const HOME_REFRESH_THRESHOLD = 72;

export function canStartHomeRefresh(mobile: boolean, home: boolean, scrollY: number, busy: boolean) {
  return mobile && home && scrollY <= 1 && !busy;
}

export function isRefreshPull(dx: number, dy: number) {
  return dy > 8 && dy > Math.abs(dx) * 1.5;
}

export function shouldRefreshHome(distance: number) {
  return distance >= HOME_REFRESH_THRESHOLD;
}