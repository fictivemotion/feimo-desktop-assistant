'use strict';
class Visibility{
 constructor(){this.manual=false;this.hover=false;this.edge=false;this.idle=true;}
 hide(){this.manual=true;this.hover=false;this.edge=true;this.idle=true;}
 reveal(explicit=true){if(this.manual&&!explicit)return false;this.manual=false;this.idle=false;return true;}
 update({active,expanded,edge,hover,card}){if(edge&&!this.edge)this.reveal();this.edge=edge;this.hover=hover;this.idle=this.manual||!expanded&&!active&&!hover&&!card&&!edge;return this.idle;}
}
module.exports={Visibility};
// Presentation is independent of visibility and does not mutate user dismissal.
function presentation({idle,expanded,sprite,card,hoverCapsule,edge}){if(idle)return 'hidden';if(expanded)return 'workbench';if(sprite&&!hoverCapsule)return 'sprite';return 'capsule';}
module.exports.presentation=presentation;
function spriteSize(value){const size=Number(value);return Number.isFinite(size)?Math.max(24,Math.min(180,Math.round(size))):90;}
module.exports.spriteSize=spriteSize;
