import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const DB_PATH = path.join(process.cwd(), 'database');
const AVAILABILITY_FILE = path.join(DB_PATH, 'availability.json');

interface AvailabilityRecord {
  intraId: string;
  intraName: string;
  availableForHelp: boolean;
  lastActive: number;
  currentProject?: string;
  apiUrl?: string;
  campus?: string;
}

// Helper function to load availability data
async function loadAvailability(): Promise<AvailabilityRecord[]> {
  try {
    const data = await fs.readFile(AVAILABILITY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to save availability data
async function saveAvailability(data: AvailabilityRecord[]): Promise<void> {
  await fs.writeFile(AVAILABILITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST /api/availability/set - Toggle availability status
router.post('/set', async (req: Request, res: Response) => {
  try {
    const { intraId, intraName, availableForHelp, currentProject, apiUrl, campus } = req.body;

    // Validation
    if (!intraId || !intraName || availableForHelp === undefined) {
      return res.status(400).json({ error: 'Missing required fields: intraId, intraName, availableForHelp' });
    }

    const availability = await loadAvailability();
    const existingIndex = availability.findIndex(record => record.intraId === intraId);

    const newRecord: AvailabilityRecord = {
      intraId,
      intraName,
      availableForHelp,
      lastActive: Date.now(),
      currentProject: currentProject || undefined,
      apiUrl: apiUrl || undefined,
      campus: campus || undefined,
    };

    if (existingIndex !== -1) {
      availability[existingIndex] = newRecord;
    } else {
      availability.push(newRecord);
    }

    await saveAvailability(availability);
    res.status(200).json({ success: true, data: newRecord });
  } catch (error) {
    console.error('Error setting availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/availability/list - Get list of available students
router.get('/list', async (req: Request, res: Response) => {
  try {
    const availability = await loadAvailability();
    
    // Filter only available students
    const availableStudents = availability.filter(
      record => record.availableForHelp === true
    );

    // Sort by most recently active
    const sorted = availableStudents.sort((a, b) => b.lastActive - a.lastActive);

    res.status(200).json({
      success: true,
      count: sorted.length,
      students: sorted,
    });
  } catch (error) {
    console.error('Error fetching availability list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/availability/student/:intraId - Get specific student availability
router.get('/student/:intraId', async (req: Request, res: Response) => {
  try {
    const { intraId } = req.params;
    const availability = await loadAvailability();
    
    const record = availability.find(r => r.intraId === intraId);
    
    if (!record) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error fetching student availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/availability/clear/:intraId - Clear availability status
router.delete('/clear/:intraId', async (req: Request, res: Response) => {
  try {
    const { intraId } = req.params;
    const availability = await loadAvailability();
    
    const filtered = availability.filter(record => record.intraId !== intraId);
    await saveAvailability(filtered);

    res.status(200).json({ success: true, message: 'Availability cleared' });
  } catch (error) {
    console.error('Error clearing availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/availability/cleanup - Remove inactive students (older than 8 hours)
router.get('/cleanup', async (req: Request, res: Response) => {
  try {
    const availability = await loadAvailability();
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;
    const now = Date.now();

    const filtered = availability.filter(
      record => (now - record.lastActive) < EIGHT_HOURS
    );

    const removed = availability.length - filtered.length;
    await saveAvailability(filtered);

    res.status(200).json({
      success: true,
      message: `Removed ${removed} inactive students`,
      remaining: filtered.length,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;