export const PUSH_ROUTE = /^#\/(today|food|workout|supps|me|help|friends|friend-challenges|together|player\/\d{4}-\d{2}-\d{2}|messages\/[A-Za-z0-9_-]{1,64})$/;
export const safeRoute=route=>typeof route==='string'&&PUSH_ROUTE.test(route)?route:'#/today';
