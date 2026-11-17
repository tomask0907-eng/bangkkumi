// 선 아이콘 모음 (docs/mockup.html과 같은 그림). <Icon name="plus" />
const PATHS = {
  plus: 'M8 3v10M3 8h10',
  x: 'M4 4l8 8M12 4l-8 8',
  check: 'M3.5 8.5l3 3 6-7',
  'chev-l': 'M10 3L5 8l5 5',
  'chev-r': 'M6 3l5 5-5 5',
  'chev-d': 'M3 6l5 5 5-5',
  left: 'M13 8H3M7 4L3 8l4 4',
  right: 'M3 8h10M9 4l4 4-4 4',
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  rotate: 'M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3',
  undo: 'M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  ext: 'M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5',
  sparkle: 'M7 2.5l1.2 3.3L11.5 7 8.2 8.2 7 11.5 5.8 8.2 2.5 7l3.3-1.2zM12.2 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z',
  upload: 'M8 10.5V3M5 6l3-3 3 3M3 10.5V13h10v-2.5',
  download: 'M8 3v7.5M5 7.5l3 3 3-3M3 10.5V13h10v-2.5',
  cube: 'M8 2l5 2.8v6.4L8 14l-5-2.8V4.8zM3 4.8l5 2.8 5-2.8M8 7.6V14',
  plan: 'M2.5 2.5h11v11h-11zM2.5 7h4.5M7 2.5V9M10 13.5V10h3.5',
  door: 'M4 13.5v-11h8v11M2.5 13.5h11M9.6 8v.6',
  window: 'M3 3h10v10H3zM8 3v10M3 8h10',
  alert: 'M8 6v3.2M8 11.4v.2M8 2.2l6.3 11.3H1.7z',
  book: 'M2.5 3.5h4a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3.5h-4A1.5 1.5 0 0 0 8 5v8a1.5 1.5 0 0 1 1.5-1.5h4z',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6L14 14',
};

export default function Icon({ name, style }) {
  return <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" style={style}><path d={PATHS[name]} /></svg>;
}
