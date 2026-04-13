// ═══════════════════════════════════════════════════════════
// ROUTE OPTIMISER — Nearest-Neighbour Greedy Algorithm
// Sufficient for 2–8 stops per team per day.
// Uses lat/lng if available, otherwise falls back to
// straight-line distance via suburb lookup.
// ═══════════════════════════════════════════════════════════

// Sunshine Coast suburb coordinates (fallback when lat/lng not geocoded)
const SUBURB_COORDS = {
  'Twin Waters':           { lat: -26.6050, lng: 153.0800 },
  'Maroochydore':          { lat: -26.6552, lng: 153.0700 },
  'Kuluin':                { lat: -26.6490, lng: 153.0490 },
  'Forest Glen':           { lat: -26.7100, lng: 152.9900 },
  'Mons':                  { lat: -26.7000, lng: 152.9650 },
  'Buderim':               { lat: -26.6800, lng: 153.0550 },
  'Alexandra Headland':    { lat: -26.6700, lng: 153.1050 },
  'Mooloolaba':            { lat: -26.6833, lng: 153.1167 },
  'Mountain Creek':        { lat: -26.6900, lng: 153.0750 },
  'Minyama':               { lat: -26.6900, lng: 153.1000 },
  'Caloundra':             { lat: -26.8000, lng: 153.1333 },
  'Pelican Waters':        { lat: -26.7900, lng: 153.1200 },
  'Little Mountain':       { lat: -26.7850, lng: 153.1000 },
  'Sippy Downs':           { lat: -26.7100, lng: 153.0500 },
  'Kawana Waters':         { lat: -26.7250, lng: 153.1000 },
  'Bokarina':              { lat: -26.7300, lng: 153.1050 },
  'Wurtulla':              { lat: -26.7400, lng: 153.1100 },
  'Birtinya':              { lat: -26.7450, lng: 153.1000 },
  'Parrearra':             { lat: -26.7550, lng: 153.1100 },
  'Buddina':               { lat: -26.7600, lng: 153.1200 },
  'Pacific Paradise':      { lat: -26.6200, lng: 153.0900 },
  'Mudjimba':              { lat: -26.6050, lng: 153.0950 },
  'Coolum Beach':          { lat: -26.5233, lng: 153.0817 },
  'Peregian Beach':        { lat: -26.4833, lng: 153.0817 },
  'Noosaville':            { lat: -26.3990, lng: 153.0630 },
  'Noosa Heads':           { lat: -26.3930, lng: 153.0900 },
};

/**
 * Get coordinates for a job (from client or suburb lookup)
 */
function getCoords(job, clients) {
  const client = clients?.find(c => c.id === (job.client_id || job.clientId));
  if (client?.lat && client?.lng) return { lat: parseFloat(client.lat), lng: parseFloat(client.lng) };
  const suburb = job.suburb || client?.suburb;
  if (suburb && SUBURB_COORDS[suburb]) return SUBURB_COORDS[suburb];
  return null;
}

/**
 * Haversine distance in km between two lat/lng points
 */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sin2 = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

/**
 * Estimate drive time in minutes from distance
 * (rough heuristic: 30 km/h avg speed in suburban areas)
 */
function estimateDriveMinutes(km) {
  return Math.round((km / 30) * 60);
}

/**
 * Nearest-neighbour greedy route optimisation.
 *
 * @param {Array}  jobs    — scheduled_jobs for one team on one day
 * @param {Array}  clients — all clients (for lat/lng lookup)
 * @param {object} [startCoords] — optional depot/home base coords
 *
 * @returns {Array} jobs reordered by optimal visiting sequence,
 *                  each augmented with { _travelFrom, _travelKm, _travelMins }
 */
export function optimiseRoute(jobs, clients, startCoords) {
  if (!jobs || jobs.length <= 1) return jobs;

  // Annotate jobs with coords
  const annotated = jobs.map(j => ({ ...j, _coords: getCoords(j, clients) }));

  // Jobs without coords go to end
  const withCoords    = annotated.filter(j => j._coords);
  const withoutCoords = annotated.filter(j => !j._coords);

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  const unvisited = [...withCoords];
  const route     = [];

  // Start from startCoords or first job
  let current = startCoords || unvisited[0]._coords;
  if (!startCoords) route.push(unvisited.shift());

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    unvisited.forEach((j, i) => {
      const d = haversineKm(current, j._coords);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });

    const next = unvisited.splice(bestIdx, 1)[0];
    const km   = haversineKm(current, next._coords);
    route.push({ ...next, _travelKm: Math.round(km * 10) / 10, _travelMins: estimateDriveMinutes(km) });
    current = next._coords;
  }

  return [...route, ...withoutCoords];
}

/**
 * Summarise total travel for a route.
 *
 * @param {Array} optimisedJobs — output of optimiseRoute
 * @returns {{ totalKm, totalTravelMins, legs }}
 */
export function routeSummary(optimisedJobs) {
  const legs = optimisedJobs
    .filter(j => j._travelKm !== undefined)
    .map((j, i) => ({
      from: optimisedJobs[i > 0 ? i - 1 : 0]?.client_name || optimisedJobs[i > 0 ? i - 1 : 0]?.clientName || 'Start',
      to:   j.client_name || j.clientName || '?',
      km:   j._travelKm,
      mins: j._travelMins,
    }));

  const totalKm          = legs.reduce((s, l) => s + l.km, 0);
  const totalTravelMins  = legs.reduce((s, l) => s + l.mins, 0);

  return { totalKm: Math.round(totalKm * 10) / 10, totalTravelMins, legs };
}
