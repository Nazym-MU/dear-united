// ═══════════════════════════════════════════════════════════════════════════
//  STORY CONTENT — edit everything here.
//
//  Each chapter has:
//    kicker  — the small label above the title ("01 · The Ground")
//    title   — the chapter heading
//    body    — array of paragraphs (plain strings)
//    stat    — optional single line of small print under the body
//    side    — 'left' | 'right'  → which side of the screen the text sits on
//    camera  — where the camera settles for this chapter
//    photos  — polaroid images. Drop files into  public/photos/  with the
//              matching filename and they appear automatically; until then a
//              quiet placeholder is shown. `rot` is the tilt in degrees.
// ═══════════════════════════════════════════════════════════════════════════

export const hero = {
  kicker: 'Manchester · est. 1910',
  title: 'Old Trafford',
  subtitle: 'The Theatre of Dreams, piece by piece.',
  cue: 'Scroll',
}

export const chapters = [
  {
    id: 'ground',
    kicker: '01 · The Ground',
    title: 'Seventy-four thousand, three hundred and ten',
    body: [
      'Old Trafford opened on 19 February 1910 with a defeat — Liverpool won 4–3 — and has spent the century since making up for it. Archibald Leitch designed the original ground for £90,000, on a stretch of land beside the Bridgewater Canal.',
      'It is still the largest club ground in Britain. Bobby Charlton called it the Theatre of Dreams, and the name stuck because it kept being true.',
    ],
    stat: 'Capacity 74,310 · the largest club stadium in the United Kingdom',
    side: 'left',
    camera: { position: [0.10, 0.62, 0.16], lookAt: [0.04, 0.06, 0.10] },
    photos: [
      { src: 'photos/ground-1.jpg', caption: 'From above', rot: -4 },
      { src: 'photos/ground-2.jpg', caption: '1910', rot: 3 },
    ],
  },
  {
    id: 'east',
    kicker: '02 · East Stand',
    title: 'The stand that came back',
    body: [
      'On 11 March 1941, German bombs meant for the Trafford Park factories flattened much of the ground. United spent eight years as guests at Maine Road — their neighbours’ home — before returning in 1949.',
      'The East Stand now holds the club museum and, on its corner, the Munich clock — stopped at 6 February 1958. Outside on the forecourt, the United Trinity stands in bronze: Best, Law, Charlton, facing the ground together.',
    ],
    stat: 'Destroyed 1941 · rebuilt 1949 · home of the museum & Munich clock',
    side: 'right',
    camera: { position: [0.62, 0.28, 0.12], lookAt: [0.04, 0.06, 0.10] },
    photos: [
      { src: 'photos/east-1.jpg', caption: 'The Munich clock', rot: 5 },
      { src: 'photos/east-2.jpg', caption: 'The Trinity', rot: -3 },
    ],
  },
  {
    id: 'stretford',
    kicker: '03 · Stretford End',
    title: 'Where the noise comes from',
    body: [
      'For half a century this was the most feared terrace in English football — a standing wall of sound behind the goal. Denis Law was its king, and the title was never really passed on.',
      'The terraces went in 1993 with the Taylor Report rebuild, but the habit remains: United attack this end in the second half. Tradition, not tactics.',
    ],
    stat: 'Rebuilt 1993 · United attack the Stretford End after half-time',
    side: 'left',
    camera: { position: [0.12, 0.26, -0.54], lookAt: [0.04, 0.07, 0.10] },
    photos: [
      { src: 'photos/stretford-1.jpg', caption: 'The old terrace', rot: -5 },
      { src: 'photos/stretford-2.jpg', caption: 'Full voice', rot: 2 },
    ],
  },
  {
    id: 'saf',
    kicker: '04 · Sir Alex Ferguson Stand',
    title: 'Twenty-six years, one name',
    body: [
      'He arrived in November 1986 with United in the bottom half of the table, and left in 2013 with thirteen league titles, two European Cups, and a statue outside this stand. It was renamed for him in 2011 — while he was still winning.',
      'Nine feet of bronze by Philip Jackson, arms folded, watching the forecourt. The largest stand in the ground carries his name and holds a quarter of the crowd.',
    ],
    stat: 'Capacity ~26,000 · renamed 2011 · statue unveiled 2012',
    side: 'right',
    camera: { position: [-0.54, 0.28, 0.10], lookAt: [0.04, 0.06, 0.10] },
    photos: [
      { src: 'photos/saf-1.jpg', caption: 'The statue', rot: 4 },
      { src: 'photos/saf-2.jpg', caption: 'May 2013, the last one', rot: -2 },
    ],
  },
  {
    id: 'bobby',
    kicker: '05 · Sir Bobby Charlton Stand',
    title: 'The quiet man opposite',
    body: [
      '758 appearances, 249 goals, a survivor of Munich, a World Cup and a European Cup. Charlton’s numbers read like club history because, mostly, they are. The South Stand took his name in 2016, with him watching from it.',
      'Beneath it runs the old players’ tunnel — the last surviving piece of the 1910 ground. The oldest part of Old Trafford sits under the stand named for its greatest servant. That feels about right.',
    ],
    stat: 'Renamed 2016 · shelters the original 1910 tunnel',
    side: 'left',
    camera: { position: [0.12, 0.26, 0.64], lookAt: [0.04, 0.06, 0.10] },
    photos: [
      { src: 'photos/bobby-1.jpg', caption: 'Sir Bobby', rot: -4 },
      { src: 'photos/bobby-2.jpg', caption: 'The tunnel', rot: 3 },
    ],
  },
  {
    id: 'pitch',
    kicker: '06 · The Pitch',
    title: 'A hundred and five by sixty-eight',
    body: [
      'Hybrid grass, stitched through with synthetic fibre, grown under lamps when the Manchester sun declines to help — which is often.',
      'From down here the stands stop being architecture and become an audience. Twenty league titles were settled on this rectangle. It keeps the score to itself.',
    ],
    stat: '105m × 68m · hybrid surface',
    side: 'right',
    camera: { position: [0.30, 0.07, 0.40], lookAt: [0.04, 0.13, 0.02] },
    photos: [
      { src: 'photos/pitch-1.jpg', caption: 'Matchday surface', rot: 3 },
      { src: 'photos/pitch-2.jpg', caption: 'Under the lights', rot: -5 },
    ],
  },
]

export const explore = {
  kicker: '07 · Your turn',
  title: 'Walk around it',
  body: 'Turn the ground to face each stand, or orbit and zoom freely. The model rewards a slow look.',
  camera: { position: [0.55, 0.42, 0.55], lookAt: [0.04, 0.08, 0.10] },
}

// Overview shot used while the stadium assembles, before the story begins.
// The lookAt sits below the model's centre so the stadium rides high in the
// frame, clear of the hero title in the lower third.
export const heroCamera = { position: [0.62, 0.46, 0.62], lookAt: [0.04, 0.0, 0.10] }

// Captions for the explore-mode stand buttons.
export const standCaptions = {
  all:   'Old Trafford · the full ground',
  east:  'East Stand · museum, Munich clock, the Trinity',
  north: 'Stretford End · the loud one',
  west:  'Sir Alex Ferguson Stand · the big one',
  south: 'Sir Bobby Charlton Stand · the old tunnel below',
}
