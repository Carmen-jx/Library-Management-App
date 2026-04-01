'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Conversation, Profile } from '@/types';

export function useChat(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!messages) { setConversations([]); return; }

      const convMap = new Map<string, Conversation>();
      for (const msg of messages) {
        const otherUser = msg.sender_id === userId ? msg.receiver as Profile : msg.sender as Profile;
        if (!convMap.has(otherUser.id)) {
          const unread = messages.filter(
            (m) => m.sender_id === otherUser.id && m.receiver_id === userId && !m.read
          ).length;
          convMap.set(otherUser.id, {
            user: otherUser,
            last_message: msg,
            unread_count: unread,
          });
        }
      }
      setConversations(Array.from(convMap.values()));
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  const loadMessages = useCallback(async (otherUserId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
        )
        .order('created_at', { ascending: true })
        .limit(100);

      setActiveMessages(data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  const send = useCallback(async (receiverId: string, content: string) => {
    if (!userId) return;
    const optimistic: Message = {
      id: crypto.randomUUID(),
      sender_id: userId,
      receiver_id: receiverId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    };
    setActiveMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: receiverId, content })
      .select()
      .single();

    if (error) throw error;
    if (data) {
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...data, sender: undefined, receiver: undefined } : m))
      );
    }
  }, [userId, supabase]);

  const markRead = useCallback(async (otherUserId: string) => {
    if (!userId) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', userId)
      .eq('read', false);

    setConversations((prev) =>
      prev.map((c) => (c.user.id === otherUserId ? { ...c, unread_count: 0 } : c))
    );
  }, [userId, supabase]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === userId || newMsg.receiver_id === userId) {
            setActiveMessages((prev) => {
              if (prev.length > 0 && prev.some((m) => m.id === newMsg.id)) return prev;
              const otherIdInConv = prev[0]?.sender_id === userId ? prev[0]?.receiver_id : prev[0]?.sender_id;
              if (
                otherIdInConv &&
                (newMsg.sender_id === otherIdInConv || newMsg.receiver_id === otherIdInConv)
              ) {
                return [...prev, newMsg];
              }
              return prev;
            });
            loadConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadConversations]);

  return { conversations, activeMessages, loading, loadConversations, loadMessages, send, markRead };
}
