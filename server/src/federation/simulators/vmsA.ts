import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Simulated Departmental VMS-A (REST inventory style — e.g. Municipal cloud VMS)
 * Different API shape from VMS-B to demonstrate heterogeneity.
 */
const cameras = [
  { id: 'MUNI-CAM-001', name: 'SG Highway Junction', status: 'online', lat: 23.0700, lng: 72.5200, streamPath: '/streams/muni-001', ptz: false, anpr: true },
  { id: 'MUNI-CAM-002', name: 'Law Garden Crossing', status: 'online', lat: 23.0245, lng: 72.5601, streamPath: '/streams/muni-002', ptz: true, anpr: true },
  { id: 'MUNI-CAM-003', name: 'Kalupur Station Approach', status: 'maintenance', lat: 23.0280, lng: 72.6000, streamPath: '/streams/muni-003', ptz: false, anpr: false },
  { id: 'MUNI-CAM-004', name: 'Sabarmati Riverfront Gate', status: 'online', lat: 23.0401, lng: 72.5720, streamPath: '/streams/muni-004', ptz: false, anpr: true },
  { id: 'MUNI-CAM-005', name: 'CG Road Market', status: 'offline', lat: 23.0330, lng: 72.5570, streamPath: '/streams/muni-005', ptz: false, anpr: true },
];

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', vendor: 'SimCloudVMS', version: '2.1.0' });
});

router.get('/api/cameras', (_req: Request, res: Response) => {
  res.json(cameras);
});

router.get('/api/cameras/:id', (req: Request, res: Response) => {
  const cam = cameras.find((c) => c.id === req.params.id);
  if (!cam) return res.status(404).json({ error: 'not found' });
  res.json(cam);
});

// Sample traffic & CCTV video clips for realistic surveillance demonstration
const VIDEO_STREAMS: Record<string, string> = {
  'MUNI-CAM-001': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'MUNI-CAM-002': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'MUNI-CAM-003': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'MUNI-CAM-004': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'MUNI-CAM-005': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
};

router.post('/api/cameras/:id/stream', (req: Request, res: Response) => {
  const cam = cameras.find((c) => c.id === req.params.id);
  if (!cam) return res.status(404).json({ error: 'not found' });
  const videoUrl = VIDEO_STREAMS[cam.id] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  res.json({
    url: videoUrl,
    protocol: 'hls',
    expiresInSec: 300,
  });
});

router.get('/streams/:id', (req: Request, res: Response) => {
  const cam = cameras.find((c) => c.id === req.params.id);
  const videoUrl = VIDEO_STREAMS[cam?.id || ''] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  res.redirect(302, videoUrl);
});


export default router;
export { cameras as vmsACameras };
