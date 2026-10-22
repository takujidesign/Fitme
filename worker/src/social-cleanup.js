import {query as q} from './accounts.js';
export async function eraseSocial(env,userId,anonymous){
 const profile=await q(env,'SELECT avatar_key FROM profiles WHERE user_id=?',userId).first();
 if(profile?.avatar_key)await env.MEDIA?.delete(profile.avatar_key);
 for(const row of (await q(env,'SELECT media_key FROM messages WHERE sender=? AND media_key IS NOT NULL',userId).all()).results)await env.MEDIA?.delete(row.media_key);
 await env.DB.batch([
  q(env,'DELETE FROM reactions WHERE user_id=? OR target_id IN (SELECT id FROM messages WHERE sender=?) OR target_id IN (SELECT id FROM feed_items WHERE user_id=?)',userId,userId,userId),
  q(env,"DELETE FROM reports WHERE reporter=? OR (target_type IN ('profile','avatar') AND target_id=?) OR (target_type='message' AND target_id IN (SELECT id FROM messages WHERE sender=?))",userId,userId,userId),
  q(env,'DELETE FROM feed_comments WHERE user_id=? OR target_id IN (SELECT id FROM feed_items WHERE user_id=?)',userId,userId),
  ...['profiles','checkins','feed_items','social_invites','conversation_members','shared_results'].map(table=>q(env,`DELETE FROM ${table} WHERE user_id=?`,userId)),
  q(env,'DELETE FROM messages WHERE sender=?',userId),
  ...['friendships','blocks','friend_duels'].map(table=>q(env,`DELETE FROM ${table} WHERE a=? OR b=?`,userId,userId)),
  q(env,'DELETE FROM friend_mutes WHERE user_id=? OR friend_id=?',userId,userId),
  q(env,'DELETE FROM buddies WHERE user_id=? OR buddy_id=?',userId,userId),
  q(env,'DELETE FROM supporters WHERE owner=?',userId),q(env,'UPDATE donations SET owner=?,note=? WHERE owner=?',anonymous,'',userId),
  q(env,'DELETE FROM idea_votes WHERE owner=? OR idea_id IN (SELECT id FROM ideas WHERE owner=?)',userId,userId),q(env,'DELETE FROM ideas WHERE owner=?',userId),
  q(env,'UPDATE supporter_codes SET claimed_by=? WHERE claimed_by=?',anonymous,userId)
 ]);
}
