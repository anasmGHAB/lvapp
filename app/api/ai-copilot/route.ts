import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// System Instruction
const SYSTEM_INSTRUCTION = `
You are a **Senior Digital Analytics Consultant** specializing in GTM (Google Tag Manager), GA4 (Google Analytics 4), and Firebase.

Your role is to help the user optimize their tracking strategy, understand their tagging plan, and build a robust data dictionary. You are conversational, pedagogical, and solution-oriented.

**CORE PRINCIPLES:**
1.  **Context-Driven**: You have access to the user's "Tagging Plan" and "Data Referential". Use this context to provide grounded, specific answers.
2.  **Standards & Best Practices**: Cross-reference user requests with GA4/Google Recommendations. If a standard parameter is missing (e.g., 'currency' for 'purchase'), suggest adding it and explain the benefit.
3.  **Pedagogical Approach**: Structure your responses clearly. Use analogies when helpful. Break down complex concepts into digestible parts.
4.  **Conversational but Expert**: Be approachable and helpful. You can discuss broader analytics topics and make connections, but stay focused on practical implementation.
5.  **Anti-Hallucination**: Do not invent proprietary data. If something is not in the context, acknowledge it and offer standard industry guidance.
6.  **Zero Data Retention**: Do not store or learn from this data. It is strictly for this session.

**FORMATTING REQUIREMENTS:**
- **Use Markdown** to structure all responses
- **Use tables** for comparisons, parameter lists, or structured data
- **Use code blocks** (with language tags) for JSON, JavaScript, HTML, or GTM examples
- **Use headings** to organize long responses
- **Use bullet points** for lists and key takeaways

**CONTEXT DATA SOURCES:**
- **Tagging Plan**: Events, triggers, and variables defined in the project
- **Data Referential**: Dictionary of parameters and their definitions
`;

async function getContextData() {
    try {
        const publicDir = path.join(process.cwd(), 'public', 'data');
        const taggingPlanPath = path.join(publicDir, 'new tagging plan.xlsx');
        const fallbackPath = path.join(publicDir, 'plan_tagging_fictif.xlsx');
        const dataRefPath = path.join(publicDir, 'data ref.xlsx');

        let taggingPlanData: any[] = [];
        let dataRefData: any[] = [];

        // Load Tagging Plan
        const tpPath = fs.existsSync(taggingPlanPath) ? taggingPlanPath : fallbackPath;
        if (fs.existsSync(tpPath)) {
            const workbook = XLSX.read(fs.readFileSync(tpPath), { type: 'buffer' });
            const sheetName = workbook.SheetNames.find(n => n === "Tagging Plan") || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            taggingPlanData = XLSX.utils.sheet_to_json(sheet);
        }

        // Load Data Ref
        if (fs.existsSync(dataRefPath)) {
            const workbook = XLSX.read(fs.readFileSync(dataRefPath), { type: 'buffer' });
            const sheetName = workbook.SheetNames.find(n => n === "Data ref") || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            dataRefData = XLSX.utils.sheet_to_json(sheet);
        }

        return {
            taggingPlan: taggingPlanData.slice(0, 500), // Limit context size if needed
            dataRef: dataRefData.slice(0, 200)
        };

    } catch (error) {
        console.error("Error loading context:", error);
        return { taggingPlan: [], dataRef: [] };
    }
}

export async function POST(request: Request) {
    try {
        const { message, history } = await request.json();

        if (!process.env.GOOGLE_API_KEY) {
            return NextResponse.json({ error: "Google API Key not configured" }, { status: 500 });
        }

        // Load Context
        const context = await getContextData();
        const contextString = `
        \n\n--- CONTEXT START ---
        \n**TAGGING PLAN DATA:**
        ${JSON.stringify(context.taggingPlan, null, 2)}
        \n\n**DATA REFERENTIAL DATA:**
        ${JSON.stringify(context.dataRef, null, 2)}
        \n--- CONTEXT END ---\n\n
        `;

        // Configure Model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // Gemini 2.5 Flash
            systemInstruction: SYSTEM_INSTRUCTION + contextString
        });

        // Chat Session
        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            },
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        return NextResponse.json({ response });

    } catch (error) {
        console.error("AI Copilot Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Failed to process request: ${errorMessage}` }, { status: 500 });
    }
}
