'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMessages, sendMessage } from '@/app/actions';
import { toast } from 'sonner';
import {
  Send, Paperclip, MessageSquare, Search, X, File,
  ImageIcon, FileText, Loader2, ChevronRight
} from 'lucide-react';

const ROLE_LABEL = {
  admin: 'Admin',
  ngo: 'NGO Partner',
  org_spoc: 'Corporate SPOC',
};

const ROLE_COLORS = {
  admin: { bg: 'bg-[#0d3b26]', text: 'text-[#0d3b26]', light: 'bg-[#f0f7f3]' },
  ngo: { bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50' },
  org_spoc: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50' },
};

function getInitials(name) {
  return name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Avatar({ name, role, size = 'md' }) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.admin;
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} ${colors.bg} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function FilePreview({ fileUrl, fileName, fileType }) {
  const isImage = fileType === 'image' || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileUrl || '');
  const isPdf = fileType === 'pdf' || /\.pdf$/i.test(fileUrl || '');

  if (isImage) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 max-w-[220px]">
        <img src={fileUrl} alt={fileName || 'Image'} className="rounded-xl max-h-44 object-cover border border-white/20" />
      </a>
    );
  }
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/20 rounded-xl px-3 py-2 transition-colors group"
    >
      {isPdf ? <FileText className="w-4 h-4 flex-shrink-0" /> : <File className="w-4 h-4 flex-shrink-0" />}
      <span className="text-xs font-medium truncate max-w-[160px]">{fileName || 'Attached file'}</span>
    </a>
  );
}

export default function ChatClient({ contacts, currentUser, initialContactId }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contactList, setContactList] = useState(contacts);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const filteredContacts = contactList.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.organizationName || '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = {
    admin: filteredContacts.filter((c) => c.role === 'admin'),
    ngo: filteredContacts.filter((c) => c.role === 'ngo'),
    org_spoc: filteredContacts.filter((c) => c.role === 'org_spoc'),
  };

  const totalUnread = contactList.reduce((s, c) => s + (c.unread || 0), 0);

  const loadMessages = useCallback(async (contactId, silent = false) => {
    if (!contactId) return;
    if (!silent) setLoadingMessages(true);
    const res = await getMessages(contactId);
    if (res.success) {
      setMessages(res.messages);
      // Mark contact as read in sidebar
      setContactList((prev) =>
        prev.map((c) => (c._id === contactId ? { ...c, unread: 0 } : c))
      );
    }
    if (!silent) setLoadingMessages(false);
  }, []);

  // Poll for new messages every 5s when a contact is selected
  useEffect(() => {
    if (!activeContact) return;
    loadMessages(activeContact._id);
    pollRef.current = setInterval(() => loadMessages(activeContact._id, true), 5000);
    return () => clearInterval(pollRef.current);
  }, [activeContact, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select contact from URL param
  useEffect(() => {
    if (initialContactId && contacts.length > 0) {
      const c = contacts.find((x) => x._id === initialContactId);
      if (c) setActiveContact(c);
    }
  }, [initialContactId, contacts]);

  const handleSend = async () => {
    if (!text.trim() || !activeContact) return;
    const fd = new FormData();
    fd.append('receiverId', activeContact._id);
    fd.append('content', text.trim());
    setText('');
    startTransition(async () => {
      const res = await sendMessage(fd);
      if (res.success) {
        setMessages((prev) => [...prev, res.message]);
      } else {
        toast.error(res.message || 'Failed to send');
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kindera/chat');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error('Upload failed');

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const fileType = isImage ? 'image' : isPdf ? 'pdf' : 'file';

      const msgFd = new FormData();
      msgFd.append('receiverId', activeContact._id);
      msgFd.append('content', '');
      msgFd.append('fileUrl', data.url);
      msgFd.append('fileName', file.name);
      msgFd.append('fileType', fileType);

      const result = await sendMessage(msgFd);
      if (result.success) {
        setMessages((prev) => [...prev, result.message]);
        toast.success('File sent!');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('File upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 top-[60px] flex bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#0d3b26]" />
              Messages
              {totalUnread > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0d3b26]/30 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto py-2">
          {Object.entries(grouped).map(([role, list]) => {
            if (!list.length) return null;
            return (
              <div key={role} className="mb-1">
                <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {ROLE_LABEL[role]}
                </p>
                {list.map((contact) => {
                  const isActive = activeContact?._id === contact._id;
                  const colors = ROLE_COLORS[contact.role] || ROLE_COLORS.admin;
                  return (
                    <button
                      key={contact._id}
                      onClick={() => setActiveContact(contact)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${
                        isActive ? 'bg-[#f0f7f3] border-r-2 border-[#0d3b26]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative">
                        <Avatar name={contact.name} role={contact.role} />
                        {contact.unread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {contact.unread > 9 ? '9+' : contact.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#0d3b26]' : 'text-gray-900'}`}>
                          {contact.name}
                        </p>
                        <p className={`text-xs truncate ${colors.text} font-medium`}>
                          {contact.organizationName || ROLE_LABEL[contact.role]}
                        </p>
                      </div>
                      {contact.unread > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {contact.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filteredContacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No contacts found</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat Window ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3.5 flex items-center gap-4 shadow-sm">
              <Avatar name={activeContact.name} role={activeContact.role} size="lg" />
              <div>
                <h3 className="font-bold text-gray-900 text-[15px]">{activeContact.name}</h3>
                <p className={`text-xs font-medium ${ROLE_COLORS[activeContact.role]?.text}`}>
                  {activeContact.organizationName || ROLE_LABEL[activeContact.role]}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-[#0d3b26] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-gray-400">Start the conversation below</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const showDate =
                    idx === 0 ||
                    new Date(messages[idx - 1].createdAt).toDateString() !==
                      new Date(msg.createdAt).toDateString();
                  return (
                    <div key={msg._id}>
                      {showDate && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[11px] text-gray-400 font-medium">
                            {new Date(msg.createdAt).toLocaleDateString('en-IN', {
                              weekday: 'long', day: 'numeric', month: 'long',
                            })}
                          </span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                      )}
                      <div className={`flex items-end gap-2.5 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                        {!msg.isMine && (
                          <Avatar name={msg.sender.name} role={msg.sender.role} size="sm" />
                        )}
                        <div className={`max-w-[65%] ${msg.isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                          {msg.isMine ? (
                            <div
                              className="px-4 py-2.5 rounded-2xl rounded-br-sm text-white text-sm shadow-sm"
                              style={{ background: 'linear-gradient(135deg, #0d3b26 0%, #1a5c3a 100%)' }}
                            >
                              {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                              {msg.fileUrl && <FilePreview fileUrl={msg.fileUrl} fileName={msg.fileName} fileType={msg.fileType} />}
                              <p className="text-[10px] text-white/60 mt-1 text-right">{formatTime(msg.createdAt)}</p>
                            </div>
                          ) : (
                            <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-gray-100 text-gray-800 text-sm shadow-sm">
                              {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                              {msg.fileUrl && (
                                <div className="mt-2">
                                  <FilePreview fileUrl={msg.fileUrl} fileName={msg.fileName} fileType={msg.fileType} />
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 mt-1">{formatTime(msg.createdAt)}</p>
                            </div>
                          )}
                        </div>
                        {msg.isMine && (
                          <Avatar name={currentUser.name} role={currentUser.role} size="sm" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-4">
              <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#0d3b26]/40 focus-within:bg-white transition-all shadow-sm">
                <input
                  type="file"
                  ref={fileRef}
                  onChange={handleFile}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xlsx,.ppt,.pptx"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-[#0d3b26] hover:bg-[#0d3b26]/10 rounded-xl transition-all"
                  title="Attach file"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 bg-transparent resize-none text-sm text-gray-800 outline-none placeholder-gray-400 max-h-32 leading-relaxed"
                  style={{ overflowY: text.split('\n').length > 4 ? 'auto' : 'hidden' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || isPending}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    text.trim() && !isPending
                      ? 'bg-[#0d3b26] hover:bg-[#1a5c3a] text-white shadow-md shadow-[#0d3b26]/30'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-mono">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-mono">Shift+Enter</kbd> for new line
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #0d3b26 0%, #2e7d52 100%)' }}
            >
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-700 mb-1">Kindera Messages</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Select a contact from the left sidebar to start a secure conversation, share documents, or exchange reports.
              </p>
            </div>
            {contactList.length > 0 && (
              <button
                onClick={() => setActiveContact(contactList[0])}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#0d3b26] text-white text-sm font-semibold rounded-xl hover:bg-[#1a5c3a] transition-colors"
              >
                Start Chatting <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
