import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Simulated Departmental VMS-B (event-oriented — e.g. Police/RTO checkpoint VMS)
 * Different endpoints, ID scheme (deviceId), and event push model than VMS-A.
 */
const devices = [
  { deviceId: 'RTO-DEV-10', deviceName: 'Naroda Checkpost ANPR', state: 'UP', geo: { lat: 23.0705, lng: 72.6570 }, livePath: '/live/rto-10' },
  { deviceId: 'RTO-DEV-11', deviceName: 'Makarba Toll Plaza', state: 'UP', geo: { lat: 22.9900, lng: 72.5000 }, livePath: '/live/rto-11' },
  { deviceId: 'RTO-DEV-12', deviceName: 'Vatva Industrial Gate', state: 'UP', geo: { lat: 22.9600, lng: 72.6400 }, livePath: '/live/rto-12' },
  { deviceId: 'POL-DEV-20', deviceName: 'SGVP Circle PTZ', state: 'UP', geo: { lat: 23.0500, lng: 72.5400 }, livePath: '/live/pol-20' },
  { deviceId: 'POL-DEV-21', deviceName: 'Ellisbridge Traffic', state: 'DOWN', geo: { lat: 23.0220, lng: 72.5650 }, livePath: '/live/pol-21' },
];

/** Demo plates — overlap with watchlist seed for alert demos */
const DEMO_PLATES = [
  'GJ01AB1234',
  'GJ05CD5678',
  'GJ18XY9999',
  'GJ27ST4321',
  'MH12DE3456',
  'GJ01WL0001', // watchlisted stolen
  'GJ05WL0002', // watchlisted blacklisted
];

const eventQueue: any[] = [];

function pushSyntheticEvent() {
  const device = devices.filter((d) => d.state === 'UP')[Math.floor(Math.random() * 4)] || devices[0];
  const plate = DEMO_PLATES[Math.floor(Math.random() * DEMO_PLATES.length)];
  eventQueue.push({
    id: randomUUID(),
    type: 'plate',
    deviceId: device.deviceId,
    plate,
    confidence: 0.85 + Math.random() * 0.14,
    priority: plate.startsWith('GJ') && plate.includes('WL') ? 'high' : 'normal',
    ts: new Date().toISOString(),
  });
  // Keep queue bounded
  while (eventQueue.length > 50) eventQueue.shift();
}

// Synthetic event generation is disabled by default to keep the database clean.
// Can be triggered manually via POST /v1/events/inject or ANPR API.
// setInterval(pushSyntheticEvent, 6000);


const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ ok: true, product: 'EventEdge VMS', build: '4.0-sim' });
});

router.get('/v1/devices', (_req: Request, res: Response) => {
  res.json({ devices });
});

// Sample traffic & ANPR video clips for realistic surveillance demonstration
const VIDEO_STREAMS_B: Record<string, string> = {
  'RTO-DEV-10': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'RTO-DEV-11': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'RTO-DEV-12': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'POL-DEV-20': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'POL-DEV-21': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
};

router.post('/v1/devices/:id/live', (req: Request, res: Response) => {
  const device = devices.find((d) => d.deviceId === req.params.id);
  if (!device) return res.status(404).json({ error: 'device not found' });
  const videoUrl = VIDEO_STREAMS_B[device.deviceId] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  res.json({
    feedUrl: videoUrl,
    ttl: 180,
  });
});

router.get('/v1/events/poll', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '5'), 10) || 5, 20);
  const events = eventQueue.splice(0, limit);
  res.json({ events });
});

router.get('/live/:id', (req: Request, res: Response) => {
  const device = devices.find((d) => d.deviceId === req.params.id);
  const videoUrl = VIDEO_STREAMS_B[device?.deviceId || ''] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  res.redirect(302, videoUrl);
});


/** Inject a plate event (for demos / ANPR worker) */
router.post('/v1/events/inject', (req: Request, res: Response) => {
  const { deviceId, plate, confidence } = req.body || {};
  const event = {
    id: randomUUID(),
    type: 'plate',
    deviceId: deviceId || devices[0].deviceId,
    plate: plate || 'GJ01AB1234',
    confidence: confidence ?? 0.95,
    priority: 'high',
    ts: new Date().toISOString(),
  };
  eventQueue.push(event);
  res.status(201).json(event);
});

export default router;
export { devices as vmsBDevices, DEMO_PLATES };
