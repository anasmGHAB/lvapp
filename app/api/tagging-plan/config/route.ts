import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { currentUser } from '@clerk/nextjs/server';

const getConfigPath = (sheet: string) => {
    const filename = sheet === 'Data ref' ? 'data-ref-config.json' : 'tagging-plan-config.json';
    return path.join(process.cwd(), 'public', 'data', filename);
};

// GET - Load config
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sheet = searchParams.get('sheet') || 'Tagging Plan';
        const CONFIG_FILE = getConfigPath(sheet);

        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json({ columns: [] });
    } catch (error) {
        console.error('Error loading config:', error);
        return NextResponse.json({ columns: [] }, { status: 500 });
    }
}

// POST - Save config
export async function POST(request: Request) {
    try {
        const user = await currentUser();
        const userEmail = user?.emailAddresses?.[0]?.emailAddress;

        if (userEmail !== "anasmghabar@gmail.com") {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const config = body.config || body; // Handle { config, sheet } or just config
        const sheet = body.sheet || 'Tagging Plan';
        const CONFIG_FILE = getConfigPath(sheet);

        // Ensure directory exists
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save config to JSON file
        // If body has 'config' key, save that, else save body (careful of sheet prop if mixed)
        const dataToSave = body.config ? body.config : body;

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(dataToSave, null, 2));

        return NextResponse.json({ success: true, message: 'Config saved successfully' });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ success: false, message: 'Failed to save config' }, { status: 500 });
    }
}
