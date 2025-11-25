import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const getPhotosPath = (sheet: string) => {
    const filename = sheet === 'Data ref' ? 'data-ref-photos.json' : 'tagging-plan-photos.json';
    return path.join(process.cwd(), 'public', 'data', filename);
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sheet = searchParams.get('sheet') || 'Tagging Plan';
        const PHOTOS_FILE = getPhotosPath(sheet);

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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const sheet = body.sheet || 'Tagging Plan';
        const PHOTOS_FILE = getPhotosPath(sheet);

        // Ensure directory exists
        const dir = path.dirname(PHOTOS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save photos to JSON file
        const dataToSave = body.photos ? body.photos : body;
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(dataToSave, null, 2));

        return NextResponse.json({ success: true, message: 'Photos saved successfully' });
    } catch (error) {
        console.error('Error saving photos:', error);
        return NextResponse.json({ success: false, message: 'Failed to save photos' }, { status: 500 });
    }
}
