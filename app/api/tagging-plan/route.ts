import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Define path to the public folder where the file is located
        const filePath = path.join(process.cwd(), 'public', 'data', 'plan_tagging_fictif.xlsx');

        // Create a new workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tagging Plan");

        // Write to buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Save to file system
        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('Error saving file:', error);
        return NextResponse.json({ success: false, message: 'Failed to save file' }, { status: 500 });
    }
}
