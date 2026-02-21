
import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { DiscussionMessage, Member } from '../types';
import { Send, Lock, MessageSquare, Loader2, Trash2, Users, Search, ChevronLeft, MoreVertical } from 'lucide-react';

interface ChatTarget {
  id: string;
  name: string;
  avatar?: string;
  type: 'group' | 'private';
}

export const GeneralDiscussion: React.FC<{ currentUser: Member | null }> = ({ currentUser }) => {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatTarget>({ id: 'group', name: 'Discussion Générale', type: 'group' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      const members = await storageService.getAllMembers();
      setAllMembers(members.filter(m => m.id !== currentUser?.id));
    };
    if (currentUser) fetchMembers();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadMessages();
    }
  }, [currentUser, selectedChat.id]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await storageService.getDiscussionMessages(50, selectedChat.id, currentUser?.id);
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
    } catch (e) {
      console.error("Erreur de chargement des messages:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const added = await storageService.addDiscussionMessage({
        authorId: currentUser.id,
        content: content,
        recipientId: selectedChat.id === 'group' ? 'group' : selectedChat.id
      });
      setMessages(prev => [...prev, added]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      alert("Erreur lors de l'envoi.");
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessageId) return;
    try {
      await storageService.deleteDiscussionMessage(selectedMessageId);
      setMessages(prev => prev.filter(m => m.id !== selectedMessageId));
      setSelectedMessageId(null);
    } catch (e) {
      alert("Impossible de supprimer.");
    }
  };

  const filteredContacts = allMembers.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6 relative animate-pulse">
          <Lock className="w-12 h-12 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Espace Privé</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">Veuillez vous connecter pour accéder aux discussions du Cluster.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-160px)] flex bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">

      {/* Sidebar - Contacts List */}
      <div className={`${isSidebarOpen ? 'w-full lg:w-80' : 'hidden lg:flex lg:w-20'} flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-dark-card transition-all duration-300 z-20`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-bold text-lg dark:text-white ${!isSidebarOpen && 'hidden'}`}>Messages</h2>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors lg:block hidden">
              <ChevronLeft className={`w-5 h-5 transition-transform ${!isSidebarOpen && 'rotate-180'}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 transition-all dark:text-gray-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {/* Global Group */}
          <button
            onClick={() => {
              setSelectedChat({ id: 'group', name: 'Discussion Générale', type: 'group' });
              if (window.innerWidth < 1024) setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${selectedChat.id === 'group' ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
          >
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div className={`text-left min-w-0 ${!isSidebarOpen && 'lg:hidden'}`}>
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">Discussion Générale</p>
              <p className="text-xs text-gray-500 truncate">Tout le Cluster</p>
            </div>
          </button>

          <div className="my-3 mx-2 border-t border-gray-100 dark:border-gray-800" />

          {/* Members List */}
          {filteredContacts.map(member => (
            <button
              key={member.id}
              onClick={() => {
                setSelectedChat({ id: member.id, name: member.businessName || member.name, avatar: member.avatar, type: 'private' });
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all mt-1 ${selectedChat.id === member.id ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            >
              <div className="relative shrink-0">
                <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></span>
              </div>
              <div className={`text-left min-w-0 ${!isSidebarOpen && 'lg:hidden'}`}>
                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{member.businessName || member.name}</p>
                <p className="text-xs text-gray-500 truncate">{member.sector || 'Membre'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 bg-gray-50/30 dark:bg-[#0f1117] relative ${isSidebarOpen && 'hidden lg:flex'}`}>
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-dark-card flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            {selectedChat.type === 'group' ? (
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
            ) : (
              <img src={selectedChat.avatar} alt={selectedChat.name} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
            )}
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white leading-tight">{selectedChat.name}</h2>
              <p className="text-[10px] text-green-500 flex items-center">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                En ligne
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Messages List */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              <p className="text-sm text-gray-400">Chargement des messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
              <MessageSquare className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 max-w-xs text-sm">Aucun message ici. Soyez la première à briser la glace !</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.authorId === currentUser.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start items-end space-x-2'}`}>
                  {!isMe && (
                    <img src={msg.authorAvatar} alt={msg.authorName} className="w-8 h-8 rounded-lg shrink-0 object-cover shadow-sm" />
                  )}
                  <div
                    onContextMenu={(e) => { if (isMe) { e.preventDefault(); setSelectedMessageId(msg.id); } }}
                    className={`max-w-[85%] lg:max-w-[70%] group transition-all transform hover:scale-[1.01] ${isMe ? 'items-end' : 'items-start'
                      }`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mb-1 ml-1">
                        {msg.authorName}
                      </p>
                    )}
                    <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative ${isMe
                        ? 'bg-primary-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700'
                      }`}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center mt-1 text-[9px] ${isMe ? 'justify-end opacity-70' : 'opacity-40'}`}>
                        <span>{msg.displayTime}</span>
                        {isMe && <span className="ml-1">✓✓</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder={selectedChat.type === 'group' ? "Écrire dans le groupe..." : `Message privé à ${selectedChat.name.split(' ')[0]}...`}
              className="flex-1 bg-transparent border-0 px-4 py-3 outline-none dark:text-gray-200 text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/30"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {selectedMessageId && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-2xl max-w-xs w-full animate-in zoom-in-95 duration-200">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-4 flex justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-center mb-2">Supprimer pour tout le monde ?</h3>
              <p className="text-xs text-gray-500 text-center mb-6">Cette action est irréversible.</p>
              <div className="flex flex-col space-y-2">
                <button onClick={handleDeleteMessage} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors">Supprimer</button>
                <button onClick={() => setSelectedMessageId(null)} className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Annuler</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
