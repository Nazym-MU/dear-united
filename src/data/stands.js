// 10 camera waypoints orbiting Old Trafford at different heights and angles.
// positions/lookAt are tuned for the compressed Lego GLB (model center ~[0.04, 0.1, 0.1]).
export const stops = [
  // 0 — wide aerial overview, corner approach
  {
    id: 'overview',
    camera: { position: [0.55, 0.42, 0.55], lookAt: [0.04, 0.08, 0.1] },
  },
  // 1 — East Stand, mid-height side-on
  {
    id: 'east-stand',
    camera: { position: [0.62, 0.28, 0.12], lookAt: [0.04, 0.06, 0.1] },
  },
  // 2 — East Stand, low dramatic angle
  {
    id: 'east-low',
    camera: { position: [0.55, 0.14, 0.22], lookAt: [0.04, 0.12, 0.1] },
  },
  // 3 — Stretford End, front-on
  {
    id: 'stretford-end',
    camera: { position: [0.12, 0.28, -0.52], lookAt: [0.04, 0.06, 0.1] },
  },
  // 4 — Stretford End, high corner
  {
    id: 'stretford-high',
    camera: { position: [-0.1, 0.44, -0.48], lookAt: [0.04, 0.08, 0.1] },
  },
  // 5 — Sir Alex Ferguson Stand, opposite side
  {
    id: 'saf-stand',
    camera: { position: [-0.52, 0.28, 0.12], lookAt: [0.04, 0.06, 0.1] },
  },
  // 6 — Sir Alex Ferguson Stand, high sweep
  {
    id: 'saf-high',
    camera: { position: [-0.44, 0.44, -0.18], lookAt: [0.04, 0.1, 0.1] },
  },
  // 7 — Sir Bobby Charlton Stand, front
  {
    id: 'bobby-stand',
    camera: { position: [0.12, 0.28, 0.62], lookAt: [0.04, 0.06, 0.1] },
  },
  // 8 — Low pitch-level, dramatic
  {
    id: 'pitch-level',
    camera: { position: [0.3, 0.06, 0.38], lookAt: [0.04, 0.14, 0.0] },
  },
  // 9 — Pure top-down, aerial outro
  {
    id: 'aerial',
    camera: { position: [0.04, 0.65, 0.1], lookAt: [0.04, 0.06, 0.1] },
  },
]

// Legacy export so ScrollIndicator still works
export const stands = stops
