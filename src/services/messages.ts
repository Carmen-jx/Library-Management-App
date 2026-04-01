import { createClient } from '@/lib/supabase/client';
import type { Message, Conversation, Profile } from '@/types';

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function getConversation(
  userId: string,
  otherUserId: string,
  limit = 50,
  offset = 0
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as Message[];
}

export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  const supabase = createClient();

  // Get all messages involving the user, ordered by most recent
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Group by conversation partner and get latest message + unread count
  const conversationMap = new Map<
    string,
    { user: Profile; last_message: Message; unread_count: number }
  >();

  for (const message of messages) {
    const partnerId =
      message.sender_id === userId ? message.receiver_id : message.sender_id;

    if (!conversationMap.has(partnerId)) {
      const partner =
        message.sender_id === userId
          ? (message.receiver as Profile)
          : (message.sender as Profile);

      conversationMap.set(partnerId, {
        user: partner,
        last_message: message as Message,
        unread_count: 0,
      });
    }

    // Count unread messages sent TO this user
    if (message.receiver_id === userId && !message.read) {
      const entry = conversationMap.get(partnerId)!;
      entry.unread_count += 1;
    }
  }

  return Array.from(conversationMap.values());
}

export async function markAsRead(messageId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('id', messageId);

  if (error) throw error;
}

export async function markConversationRead(
  userId: string,
  otherUserId: string
) {
  const supabase = createClient();

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', otherUserId)
    .eq('receiver_id', userId)
    .eq('read', false);

  if (error) throw error;
}
