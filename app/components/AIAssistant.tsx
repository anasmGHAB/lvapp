"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
    PaperAirplaneIcon,
    SparklesIcon,
    UserCircleIcon,
    CpuChipIcon,
    StopIcon,
    PlusIcon,
    TrashIcon,
    PaperClipIcon,
    XMarkIcon,
    PhotoIcon
} from "@heroicons/react/24/outline";

interface ImageAttachment {
    data: string; // base64
    mimeType: string;
    name: string;
}

interface Message {
    role: "user" | "model";
    parts: string;
    images?: ImageAttachment[];
}

interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = "ai_conversations";
const DEFAULT_MESSAGE: Message = {
    role: "model",
    parts: "Hello! I am your Digital Analytics AI Copilot. I have access to your Tagging Plan and Data Referential. How can I help you optimize your tracking today?",
};

export default function AIAssistant() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load conversations from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setConversations(parsed);
                if (parsed.length > 0) {
                    loadConversation(parsed[0].id, parsed);
                }
            } catch (error) {
                console.error("Failed to load conversations:", error);
            }
        }
    }, []);

    // Save conversations to localStorage whenever they change
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        }
    }, [conversations]);

    // Auto-save current conversation
    useEffect(() => {
        if (currentConversationId && messages.length > 1) {
            saveCurrentConversation();
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const generateId = () => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const generateTitle = (firstMessage: string) => {
        return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    };

    const createNewConversation = () => {
        const newConv: Conversation = {
            id: generateId(),
            title: "New Conversation",
            messages: [DEFAULT_MESSAGE],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
        setMessages([DEFAULT_MESSAGE]);
        setAttachedImages([]);
    };

    const loadConversation = (id: string, convList?: Conversation[]) => {
        const list = convList || conversations;
        const conv = list.find(c => c.id === id);
        if (conv) {
            setCurrentConversationId(id);
            setMessages(conv.messages);
            setAttachedImages([]);
        }
    };

    const saveCurrentConversation = () => {
        if (!currentConversationId) return;

        setConversations(prev => prev.map(conv => {
            if (conv.id === currentConversationId) {
                // Auto-generate title from first user message if still "New Conversation"
                let title = conv.title;
                if (title === "New Conversation" && messages.length > 1) {
                    const firstUserMsg = messages.find(m => m.role === "user");
                    if (firstUserMsg) {
                        title = generateTitle(firstUserMsg.parts);
                    }
                }
                return {
                    ...conv,
                    title,
                    messages,
                    updatedAt: Date.now(),
                };
            }
            return conv;
        }));
    };

    const deleteConversation = (id: string) => {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversationId === id) {
            if (conversations.length > 1) {
                const nextConv = conversations.find(c => c.id !== id);
                if (nextConv) loadConversation(nextConv.id);
            } else {
                createNewConversation();
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith("image/")) continue;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                const base64Data = base64.split(",")[1]; // Remove data:image/...;base64, prefix

                setAttachedImages(prev => [...prev, {
                    data: base64Data,
                    mimeType: file.type,
                    name: file.name,
                }]);
            };
            reader.readAsDataURL(file);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    const base64Data = base64.split(",")[1];

                    setAttachedImages(prev => [...prev, {
                        data: base64Data,
                        mimeType: file.type,
                        name: `pasted-image-${Date.now()}.png`,
                    }]);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const removeImage = (index: number) => {
        setAttachedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if (!input.trim() && attachedImages.length === 0) return;

        // Create new conversation if none exists
        if (!currentConversationId) {
            createNewConversation();
        }

        const userMessage: Message = {
            role: "user",
            parts: input,
            images: attachedImages.length > 0 ? [...attachedImages] : undefined,
        };

        setInput("");
        setAttachedImages([]);
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const historyForApi = messages
                .filter((_, index) => index > 0 || messages[0].role !== "model")
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.parts }],
                }));

            abortControllerRef.current = new AbortController();

            const response = await fetch("/api/ai-copilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    history: historyForApi,
                    images: attachedImages,
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
        <div className="flex h-screen max-h-screen bg-slate-900/50 backdrop-blur-sm text-slate-200">
            {/* Conversations Sidebar */}
            {sidebarOpen && (
                <div className="w-64 border-r border-white/10 bg-slate-900/80 flex flex-col">
                    <div className="p-4 border-b border-white/10">
                        <button
                            onClick={createNewConversation}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            New Chat
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${currentConversationId === conv.id
                                        ? "bg-indigo-600/20 border border-indigo-500/30"
                                        : "hover:bg-white/5"
                                    }`}
                                onClick={() => loadConversation(conv.id)}
                            >
                                <SparklesIcon className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                                <span className="flex-1 text-sm truncate">{conv.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteConversation(conv.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                                >
                                    <TrashIcon className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 p-6 border-b border-white/10 bg-slate-900/80">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">AI Copilot</h1>
                        <p className="text-xs text-slate-400">Context-Aware Digital Analytics Assistant</p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                                }`}>
                                {msg.role === "user" ? <UserCircleIcon className="w-5 h-5" /> : <CpuChipIcon className="w-5 h-5" />}
                            </div>

                            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === "user"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white/5 border border-white/10 text-slate-200"
                                }`}>
                                {msg.images && msg.images.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {msg.images.map((img, imgIdx) => (
                                            <img
                                                key={imgIdx}
                                                src={`data:${img.mimeType};base64,${img.data}`}
                                                alt={img.name}
                                                className="max-w-xs rounded-lg border border-white/20"
                                            />
                                        ))}
                                    </div>
                                )}

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
                <div className="p-6 border-t border-white/10 bg-slate-900/80">
                    {/* Image Previews */}
                    {attachedImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {attachedImages.map((img, idx) => (
                                <div key={idx} className="relative group">
                                    <img
                                        src={`data:${img.mimeType};base64,${img.data}`}
                                        alt={img.name}
                                        className="h-20 w-20 object-cover rounded-lg border border-white/20"
                                    />
                                    <button
                                        onClick={() => removeImage(idx)}
                                        className="absolute -top-2 -right-2 p-1 bg-red-600 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <XMarkIcon className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative max-w-4xl mx-auto">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Ask about your tagging plan, GA4 events, or paste/attach images..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-24 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                            rows={1}
                            style={{ minHeight: "50px" }}
                        />

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                title="Attach image"
                            >
                                <PaperClipIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                        AI can make mistakes. Please verify important information.
                    </p>
                </div>
            </div>
        </div>
    );
}
