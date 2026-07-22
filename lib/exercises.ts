// Supplementary training routines for runners — warm-up, stretching, core,
// plyometrics, foam rolling. Static content driven by a guided player
// (per-exercise timer + voice cues). No DB, no AI cost.

export type Exercise = {
  name: string
  seconds: number
  desc: string
}

export type Routine = {
  id: string
  title: string
  emoji: string
  focus: string
  when: string
  exercises: Exercise[]
}

export const ROUTINES: Routine[] = [
  {
    id: 'warmup',
    title: 'Rozgrzewka przed biegiem',
    emoji: '🤸',
    focus: 'Mobilizacja i podniesienie tętna',
    when: 'Tuż przed każdym treningiem biegowym',
    exercises: [
      { name: 'Trucht w miejscu', seconds: 60, desc: 'Luźny trucht, rozluźnij ramiona, oddychaj spokojnie.' },
      { name: 'Krążenia ramion', seconds: 30, desc: 'Obszerne koła w przód i w tył, na przemian.' },
      { name: 'Krążenia bioder', seconds: 30, desc: 'Ręce na biodrach, szerokie koła w obie strony.' },
      { name: 'Wymachy nóg przód-tył', seconds: 45, desc: 'Trzymaj się ściany/płotu. Zmień nogę w połowie czasu.' },
      { name: 'Wymachy nóg na boki', seconds: 45, desc: 'Wahadłowe wymachy przed sobą. Zmień nogę w połowie.' },
      { name: 'Skip A w miejscu', seconds: 30, desc: 'Wysokie kolana, szybka praca ramion, ląduj na śródstopiu.' },
      { name: 'Przysiady', seconds: 40, desc: 'Pełen zakres, pięty na ziemi, ręce przed sobą.' },
      { name: 'Wykroki dynamiczne', seconds: 40, desc: 'Naprzemienne wykroki w miejscu, tułów prosto.' },
    ],
  },
  {
    id: 'stretching',
    title: 'Rozciąganie po biegu',
    emoji: '🧘',
    focus: 'Regeneracja i zakres ruchu',
    when: 'Do 15 min po zakończeniu biegu',
    exercises: [
      { name: 'Łydki przy ścianie', seconds: 60, desc: 'Noga zakroczna prosta, pięta w podłodze. Zmień stronę w połowie.' },
      { name: 'Czworogłowe uda', seconds: 60, desc: 'Stojąc, przyciągnij piętę do pośladka. Zmień nogę w połowie.' },
      { name: 'Dwugłowe uda', seconds: 60, desc: 'Skłon do wyprostowanej nogi na podwyższeniu. Zmień w połowie.' },
      { name: 'Zginacze bioder', seconds: 60, desc: 'Klęk jednonóż, biodra pchnij w przód. Zmień stronę w połowie.' },
      { name: 'Pośladki („czwórka")', seconds: 60, desc: 'Leżąc, kostka na kolanie, przyciągnij udo. Zmień w połowie.' },
      { name: 'Przywodziciele', seconds: 40, desc: 'Szeroki rozkrok, przenoś ciężar z nogi na nogę.' },
      { name: 'Skłon rozluźniający', seconds: 40, desc: 'Luźny skłon, głowa i ramiona swobodnie zwisają.' },
    ],
  },
  {
    id: 'core',
    title: 'Core biegacza',
    emoji: '💪',
    focus: 'Stabilizacja tułowia i bioder',
    when: '2-3× w tygodniu, w dni lżejsze',
    exercises: [
      { name: 'Plank', seconds: 45, desc: 'Łokcie pod barkami, napięty brzuch i pośladki, nie zadzieraj głowy.' },
      { name: 'Plank boczny — lewa', seconds: 30, desc: 'Ciało w linii, biodro wysoko.' },
      { name: 'Plank boczny — prawa', seconds: 30, desc: 'Ciało w linii, biodro wysoko.' },
      { name: 'Dead bug', seconds: 40, desc: 'Na plecach, naprzemiennie opuszczaj rękę i przeciwną nogę. Lędźwie w podłodze.' },
      { name: 'Bird dog', seconds: 40, desc: 'W klęku podpartym unieś przeciwną rękę i nogę, chwila zatrzymania.' },
      { name: 'Glute bridge', seconds: 45, desc: 'Unieś biodra, zaciśnij pośladki na górze, powoli opuszczaj.' },
      { name: 'Mountain climbers', seconds: 30, desc: 'W podporze dynamicznie przyciągaj kolana do klatki.' },
      { name: 'Plank — finał', seconds: 45, desc: 'Ostatnie deski! Utrzymaj idealną pozycję do końca.' },
    ],
  },
  {
    id: 'plyo',
    title: 'Skipy i podskoki',
    emoji: '⚡',
    focus: 'Moc, sprężystość, technika',
    when: 'Po rozgrzewce, przed akcentem albo osobno',
    exercises: [
      { name: 'Pajacyki', seconds: 30, desc: 'Równe tempo, miękkie lądowanie.' },
      { name: 'Odpoczynek', seconds: 15, desc: 'Wytrząśnij nogi, spokojny oddech.' },
      { name: 'Skip A', seconds: 30, desc: 'Wysokie kolana, aktywne ramiona, sylwetka wysoka.' },
      { name: 'Odpoczynek', seconds: 15, desc: 'Wytrząśnij nogi.' },
      { name: 'Skip C', seconds: 30, desc: 'Pięty do pośladków, szybka kadencja.' },
      { name: 'Odpoczynek', seconds: 15, desc: 'Spokojny oddech.' },
      { name: 'Przeskoki boczne', seconds: 30, desc: 'Obunóż przez wyobrażoną linię, miękko na śródstopiu.' },
      { name: 'Odpoczynek', seconds: 15, desc: 'Wytrząśnij nogi.' },
      { name: 'Podskoki obunóż', seconds: 30, desc: 'Sprężyste, niskie podskoki — jak na skakance.' },
      { name: 'Odpoczynek', seconds: 15, desc: 'Ostatnia przerwa.' },
      { name: 'Wykroki z wyskokiem', seconds: 30, desc: 'Wykrok → dynamiczna zmiana nóg w wyskoku. Kontrola lądowania.' },
    ],
  },
  {
    id: 'rolling',
    title: 'Rolowanie',
    emoji: '🌀',
    focus: 'Rozluźnienie mięśni i powięzi',
    when: 'Wieczorem lub po ciężkim treningu',
    exercises: [
      { name: 'Łydki', seconds: 60, desc: 'Powoli od ścięgna Achillesa do kolana. Zmień nogę w połowie.' },
      { name: 'Uda — przód', seconds: 60, desc: 'W podporze, roluj od biodra do kolana. Zmień w połowie.' },
      { name: 'Uda — tył', seconds: 60, desc: 'Siedząc, roluj od pośladka do kolana. Zmień w połowie.' },
      { name: 'Pośladki', seconds: 45, desc: 'Usiądź na rolerze, lekko przechyl się na stronę rolowaną.' },
      { name: 'Pasmo biodrowo-piszczelowe', seconds: 60, desc: 'Bok uda, roluj POWOLI — to bywa wrażliwe. Zmień w połowie.' },
      { name: 'Plecy — odcinek piersiowy', seconds: 45, desc: 'Roler pod łopatkami, ręce za głową, nie roluj lędźwi.' },
    ],
  },
  {
    id: 'drills',
    title: 'Drills techniczne',
    emoji: '🏃',
    focus: 'Ekonomia biegu i technika',
    when: 'Po rozgrzewce, przed akcentem (tempo/interwały)',
    exercises: [
      { name: 'Marsz na palcach', seconds: 30, desc: 'Wysoko na śródstopiu, wyprostowana sylwetka, aktywne łydki.' },
      { name: 'Skip A', seconds: 30, desc: 'Wysokie kolano, biodro w górę, ląduj pod środkiem ciężkości.' },
      { name: 'Skip B', seconds: 30, desc: 'Wyrzut podudzia z kolana i „drapanie" stopą o ziemię pod sobą.' },
      { name: 'Skip C (pięty)', seconds: 30, desc: 'Pięty szybko do pośladków, wysoka kadencja, biodra stabilne.' },
      { name: 'Doskoki (bounding)', seconds: 30, desc: 'Długie, sprężyste kroki-odbicia. Faza lotu, mocna praca ramion.' },
      { name: 'Krok dostawny', seconds: 30, desc: 'Bokiem, sprężyste dostawianie stóp. Zmień kierunek w połowie.' },
      { name: 'Przyspieszenia (stridy)', seconds: 40, desc: 'Płynne rozpędzenie do ~90% na 60-80 m, luźno. Powtórz kilka razy.' },
    ],
  },
  {
    id: 'hips',
    title: 'Mobilność bioder',
    emoji: '🦵',
    focus: 'Zakres ruchu w biodrach',
    when: 'W dni bez biegania lub po lekkim biegu',
    exercises: [
      { name: 'Krążenia bioder w klęku', seconds: 40, desc: 'Klęk podparty, kolano zatacza duże koła. Zmień nogę w połowie.' },
      { name: 'Otwieranie bioder („90/90")', seconds: 60, desc: 'Siad, obie nogi zgięte 90°, przenoś kolana z boku na bok.' },
      { name: 'Wykrok z rotacją', seconds: 50, desc: 'Głęboki wykrok, łokieć do podłogi przy przedniej stopie, skręt tułowia. Zmień stronę.' },
      { name: 'Gołąb (pigeon)', seconds: 60, desc: 'Przednia goleń w poprzek, tylna noga wyprostowana, opadaj tułowiem. Zmień w połowie.' },
      { name: 'Most biodrowy jednonóż', seconds: 40, desc: 'Jedna noga uniesiona, wypchnij biodra pośladkiem. Zmień w połowie.' },
      { name: 'Przysiad głęboki — trzymanie', seconds: 45, desc: 'Zejdź w pełny przysiad, łokcie rozpychają kolana, plecy proste.' },
    ],
  },
  {
    id: 'feet',
    title: 'Stopy i profilaktyka',
    emoji: '🦶',
    focus: 'Wzmocnienie stóp i stawu skokowego',
    when: '2-3× w tygodniu, także boso przed TV',
    exercises: [
      { name: 'Wspięcia na palce', seconds: 45, desc: 'Powoli w górę i w dół, pełen zakres. Trzymaj się ściany dla równowagi.' },
      { name: 'Wspięcia na zgiętych kolanach', seconds: 40, desc: 'Kolana lekko ugięte — angażuje płaszczkowaty. Powoli.' },
      { name: 'Chód na piętach', seconds: 30, desc: 'Palce w górę, idź na piętach — wzmacnia przód goleni (piszczel).' },
      { name: 'Zwijanie ręcznika palcami', seconds: 40, desc: 'Stopą przyciągaj ręcznik palcami. Zmień stopę w połowie.' },
      { name: 'Krótka stopa („short foot")', seconds: 40, desc: 'Bez zginania palców „skróć" stopę, unosząc podbicie. Utrzymaj napięcie.' },
      { name: 'Balans na jednej nodze', seconds: 40, desc: 'Stój na jednej nodze, oczy zamknięte jeśli dasz radę. Zmień w połowie.' },
      { name: 'Wspięcia jednonóż', seconds: 40, desc: 'Na jednej nodze, kontrolowane wspięcia. Zmień w połowie.' },
    ],
  },
  {
    id: 'express',
    title: 'Ekspres 5 minut',
    emoji: '⏱️',
    focus: 'Gdy mało czasu — minimum mobilności',
    when: 'Przed biegiem, gdy się spieszysz',
    exercises: [
      { name: 'Trucht w miejscu', seconds: 45, desc: 'Rozgrzej ciało, rozluźnij ramiona.' },
      { name: 'Wymachy nóg przód-tył', seconds: 40, desc: 'Trzymaj się podpory. Zmień nogę w połowie.' },
      { name: 'Wykroki dynamiczne', seconds: 40, desc: 'Naprzemienne, tułów prosto.' },
      { name: 'Skip A', seconds: 30, desc: 'Wysokie kolana, aktywne ramiona.' },
      { name: 'Skip C (pięty)', seconds: 30, desc: 'Pięty do pośladków, szybko.' },
      { name: 'Przyspieszenie', seconds: 35, desc: 'Płynnie rozpędź się do ~85%, potem luźno. Gotowy do biegu!' },
    ],
  },
]

export function routineDuration(r: Routine): number {
  return r.exercises.reduce((s, e) => s + e.seconds, 0)
}

export function findRoutine(id: string | null): Routine | null {
  return ROUTINES.find(r => r.id === id) ?? null
}

/** Compact catalog for the AI coach's system prompt. */
export function routineCatalog(): string {
  return ROUTINES.map(r =>
    `- ${r.title} (${Math.round(routineDuration(r) / 60)} min) — ${r.focus}; kiedy: ${r.when}`
  ).join('\n')
}
