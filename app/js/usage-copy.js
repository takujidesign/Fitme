import {L,esc} from './ui.js';
import {telemetryPrivacy} from './usage-copy-data.js';
export const privacyNotice=()=>'<p class="note">'+esc(L(...telemetryPrivacy))+'</p>';
