import type { ThreadMetadata, ThreadConversationFlow } from "../types/mr-feedback.js";

/**
 * Analyzes a GitLab discussion thread to extract conversation flow and metadata
 */
export function analyzeDiscussionThread(discussion: any): ThreadMetadata[] {
  const notes = discussion.notes || [];
  const isIndividualNote = discussion.individual_note || false;
  const discussionId = discussion.id?.toString() || 'unknown';
  
  // Filter out system notes for user interaction analysis
  const userNotes = notes.filter((note: any) => !note.system);
  const totalNotes = notes.length;
  
  // Determine if the thread is resolved
  // A thread is considered resolved if ALL resolvable notes in it are resolved
  const resolvableNotes = notes.filter((note: any) => note.resolvable);
  const resolvedNotes = resolvableNotes.filter((note: any) => note.resolved);
  const isResolved = resolvableNotes.length > 0 && resolvedNotes.length === resolvableNotes.length;
  
  // Build conversation flow
  const conversationFlow: ThreadConversationFlow[] = notes.map((note: any, index: number) => {
    const role = determineConversationRole(note, notes, index);
    
    return {
      noteId: note.id?.toString() || `note-${index}`,
      author: note.author?.username || 'unknown',
      body: note.body || '',
      isSystemNote: Boolean(note.system),
      notePosition: index,
      isResolved: Boolean(note.resolved),
      conversationRole: role
    };
  });
  
  // Create metadata for each note in the discussion
  const threadMetadataArray: ThreadMetadata[] = notes.map((note: any, index: number) => ({
    discussionId,
    isResolved,
    totalNotes,
    userNotes: userNotes.length,
    isIndividualNote,
    threadPosition: index,
    conversationFlow
  }));
  
  return threadMetadataArray;
}

/**
 * Determines the conversation role of a note within a thread
 */
function determineConversationRole(
  note: any, 
  allNotes: any[], 
  noteIndex: number
): ThreadConversationFlow['conversationRole'] {
  // First note is always the initiator
  if (noteIndex === 0) {
    return 'initiator';
  }
  
  // If the note resolves a thread, it's a resolver
  if (note.resolved && !allNotes[noteIndex - 1]?.resolved) {
    return 'resolver';
  }
  
  // System notes don't have conversation roles
  if (note.system) {
    return 'responder'; // Default for system notes
  }
  
  // If the note body contains question markers, it's likely seeking clarification
  const body = note.body?.toLowerCase() || '';
  if (body.includes('?') || 
      body.includes('can you') || 
      body.includes('could you') ||
      body.includes('what do you mean') ||
      body.includes('clarify') ||
      body.includes('explain')) {
    return 'clarifier';
  }
  
  // If the note is responding to the previous note from a different author, it's a responder
  const previousNote = allNotes[noteIndex - 1];
  if (previousNote && previousNote.author?.username !== note.author?.username) {
    return 'responder';
  }
  
  // Default to clarifier for additional context or follow-ups from the same author
  return 'clarifier';
}

/**
 * Builds enriched context from a thread conversation for analysis
 */
export function buildThreadContext(
  discussionId: string, 
  notePosition: number, 
  conversationFlow: ThreadConversationFlow[]
): string {
  if (conversationFlow.length <= 1) {
    return ''; // No conversation context for single notes
  }
  
  // Build conversation context up to (but not including) the current note
  const contextNotes = conversationFlow.slice(0, notePosition);
  
  if (contextNotes.length === 0) {
    return ''; // This is the first note, no prior context
  }
  
  const context = contextNotes.map((flow, index) => {
    const roleEmoji = {
      initiator: '🎯',
      responder: '💬',
      clarifier: '❓',
      resolver: '✅'
    }[flow.conversationRole];
    
    return `${roleEmoji} ${flow.author}: "${flow.body.slice(0, 150)}${flow.body.length > 150 ? '...' : ''}"`;
  }).join('\n');
  
  return `Thread Conversation Context (${contextNotes.length} previous messages):\n${context}`;
}

/**
 * Determines if a comment should be analyzed for actionable feedback
 * Resolved threads are used for context but not for generating action items
 */
export function shouldAnalyzeForAction(threadMetadata: ThreadMetadata): boolean {
  // Don't analyze resolved threads for action items
  if (threadMetadata.isResolved) {
    return false;
  }
  
  // Individual notes (not part of a threaded conversation) should be analyzed
  if (threadMetadata.isIndividualNote) {
    return true;
  }
  
  // For threaded discussions, analyze if the thread is not resolved
  return !threadMetadata.isResolved;
}

/**
 * Gets a summary of thread activity for display purposes
 */
export function getThreadSummary(threadMetadata: ThreadMetadata): string {
  const { totalNotes, userNotes, isResolved, isIndividualNote } = threadMetadata;
  
  if (isIndividualNote) {
    return isResolved ? '📝 Resolved note' : '📝 Individual note';
  }
  
  const status = isResolved ? '✅ Resolved' : '🔄 Active';
  const noteCount = userNotes === totalNotes 
    ? `${totalNotes} notes` 
    : `${userNotes}/${totalNotes} user notes`;
    
  return `${status} thread (${noteCount})`;
}