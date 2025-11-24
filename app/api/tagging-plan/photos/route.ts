import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const PHOTOS_FILE = path.join(process.cwd(), 'public', 'data', 'tagging-plan-photos.json');

// GET - Load photos
export async function GET() {
    try {
        if (fs.existsSync(PHOTOS_FILE)) {
            const data = fs.readFileSync(PHOTOS_FILE, 'utf-8');
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json({});
    } catch (error) {
        console.error('Error loading photos:', error);
        return NextResponse.json({}, { status: 500 });
    }
}

import { currentUser } from '@clerk/nextjs/server';

// POST - Save photos
export async function POST(request: Request) {
    try {
        const user = await currentUser();
        const userEmail = user?.emailAddresses?.[0]?.emailAddress;

        if (userEmail !== "anasmghabar@gmail.com") {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
        }

        const photos = await request.json();

        // Ensure directory exists
        const dir = path.dirname(PHOTOS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save photos to JSON file
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));

        return NextResponse.json({ success: true, message: 'Photos saved successfully' });
    } catch (error) {
        console.error('Error saving photos:', error);
        return NextResponse.json({ success: false, message: 'Failed to save photos' }, { status: 500 });
    }
}
