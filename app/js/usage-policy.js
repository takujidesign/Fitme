// Shared closed vocabulary: no free text, identifiers or health values.
export const ROUTES='today workout food supps me chat friends gyms coach account guide daily-menu health settings other'.split(' ');
export const FEATURES='workout_start workout_done meal_logged daily_menu_edit food_scan_barcode label_scan meal_photo_ai body_photo_ai ai_chat byok_gemini byok_openai byok_kie claude_credits health_import reminder_set push_enabled push_test chat_message friend_added gym_checkin backup_export sync_now logout theme_change language_change update_applied share'.split(' ');
export const EVENTS=['onboarding_done','workout_done','purchase_started','purchase_completed','ai_used','account_created','app_open','screen_view','feature_used','error'];
export const DIMS={platform:['ios-pwa','ios-safari','android-pwa','android-browser','desktop'],lang:['th','en','zh','ja','vi'],theme:['light','dark'],account:['yes','no']};
export function validEvent(e){
 if(!e||typeof e!=='object'||Object.keys(e).some(k=>!['kind','name','dims'].includes(k))||!EVENTS.includes(e.name)||e.kind!==(e.name==='error'?'error':'event'))return false;
 if(e.dims===null)return false;const d=e.dims||{};if(typeof d!=='object'||Array.isArray(d))return false;const keys=Object.keys(d);
 if(e.name==='app_open')return keys.length===5&&keys.every(k=>k==='version'?typeof d[k]==='string'&&/^(?:[a-f0-9]{7,12}|dev)$/.test(d[k]):DIMS[k]?.includes(d[k]));
 if(e.name==='screen_view')return keys.length===1&&ROUTES.includes(d.route);
 if(e.name==='feature_used')return keys.length===1&&FEATURES.includes(d.feature);
 return keys.length===0;
}
