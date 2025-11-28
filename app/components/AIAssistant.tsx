"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { PaperAirplaneIcon, SparklesIcon, UserCircleIcon, CpuChipIcon, StopIcon } from "@heroicons/react/24/outline";

interface Message {
    role: "user" | "model";
    parts: string;
}

export default function AIAssistant() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "model",
            parts: "Hello! I am your Digital Analytics AI Copilot. I have access to your Tagging Plan and Data Referential. How can I help you optimize your tracking today?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", parts: userMessage }]);
        setIsLoading(true);

        try {
            // Prepare history for API (excluding the last user message we just added locally)
            // Gemini expects history in { role: "user" | "model", parts: [{ text: string }] } format usually, 
            // but our API route handles the simplification or we should match what the API expects.
            // Let's look at our API route: `const { message, history } = await request.json();`
            // And `history: history || []` passed to `startChat`.
            // The Google Node SDK expects history as `Content[]`.
            // Let's map our simple state to the SDK format if needed, or just pass the simple state if the API handles it.
            // Looking at the API code I wrote: `history: history || []`. 
            // The SDK `startChat` expects `history` to be `Content[]`.
            // `Content` is `{ role: string, parts: Part[] }`. `Part` is `{ text: string }`.

            // Filter out the initial model message if it exists, as Gemini history must start with 'user'
            const historyForApi = messages
                .filter((_, index) => index > 0 || messages[0].role !== "model")
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.parts }]
                }));

            // Create AbortController for this request
            abortControllerRef.current = new AbortController();

            const response = await fetch("/api/ai-copilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    history: historyForApi,
                }),
                signal: abortControllerRef.current.signal,
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setMessages((prev) => [...prev, { role: "model", parts: data.response }]);
        } catch (error) {
            console.error("Chat Error:", error);
            // Don't show error if request was aborted by user
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Request aborted by user');
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "model", parts: `**Error:** ${error instanceof Error ? error.message : "An unknown error occurred."}` },
                ]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen max-h-screen bg-slate-900/50 backdrop-blur-sm text-slate-200">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-white/10 bg-slate-900/80 sticky top-0 z-10">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">AI Copilot</h1>
                    <p className="text-xs text-slate-400">Context-Aware Digital Analytics Assistant</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            }`}>
                            {msg.role === "user" ? <UserCircleIcon className="w-5 h-5" /> : <CpuChipIcon className="w-5 h-5" />}
                        </div>

                        {/* Message Bubble */}
                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "bg-white/5 border border-white/10 text-slate-200"
                            }`}>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        table({ children }) {
                                            return (
                                                <div className="overflow-x-auto my-4">
                                                    <table className="min-w-full border border-white/20 rounded-lg">{children}</table>
                                                </div>
                                            );
                                        },
                                        thead({ children }) {
                                            return <thead className="bg-white/10">{children}</thead>;
                                        },
                                        tbody({ children }) {
                                            return <tbody className="divide-y divide-white/10">{children}</tbody>;
                                        },
                                        tr({ children }) {
                                            return <tr className="hover:bg-white/5 transition-colors">{children}</tr>;
                                        },
                                        th({ children }) {
                                            return <th className="px-4 py-2 text-left font-semibold text-white border-b border-white/20">{children}</th>;
                                        },
                                        td({ children }) {
                                            return <td className="px-4 py-2 text-slate-300">{children}</td>;
                                        },
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || "");
                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={`${className} bg-white/10 rounded px-1 py-0.5`} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                    }}
                                >
                                    {msg.parts}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-4 items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                            <CpuChipIcon className="w-5 h-5" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <button
                            onClick={handleStop}
                            className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                            title="Stop generation"
                        >
                            <StopIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-white/10 bg-slate-900/80 sticky bottom-0 z-10">
                <div className="relative max-w-4xl mx-auto">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your tagging plan, GA4 events, or data dictionary..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none scrollbar-hide"
                        rows={1}
                        style={{ minHeight: "50px" }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-center text-xs text-slate-500 mt-2">
                    AI can make mistakes. Please verify important information.
                </p>
            </div>
        </div>
    );
}
