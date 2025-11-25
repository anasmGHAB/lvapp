import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
    try {
        const { data, sheetName } = await request.json();
        const targetSheet = sheetName || "Tagging Plan";

        // Define path to the public folder where the file is located
        const filePath = path.join(process.cwd(), 'public', 'data', 'plan_tagging_fictif.xlsx');

        let workbook;
        if (fs.existsSync(filePath)) {
            // Read existing file
            const fileBuffer = fs.readFileSync(filePath);
            workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        } else {
            // Create new if doesn't exist
            workbook = XLSX.utils.book_new();
        }

        // Convert JSON to sheet
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Check if sheet exists
        if (workbook.SheetNames.includes(targetSheet)) {
            // Update existing sheet
            workbook.Sheets[targetSheet] = worksheet;
        } else {
            // Append new sheet
            XLSX.utils.book_append_sheet(workbook, worksheet, targetSheet);
        }

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
